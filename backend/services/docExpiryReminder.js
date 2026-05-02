// Daily check for driver document expirations.
// Sends push + email reminders at 30/14/7/1 day thresholds and on the
// expiry day itself. Tracks sent reminders per (doc, threshold) so the
// same one is never sent twice — until the driver updates the doc.

const Driver = require('../models/Driver');
const User = require('../models/User');
const { sendPushNotification } = require('./pushService');
const nodemailer = require('nodemailer');

// Buckets in days. 0 = day-of expiry. Order matters: cron applies the
// LARGEST applicable bucket first, marks it sent, and skips any smaller
// buckets — otherwise a doc expiring in 5 days would trigger both 7 and 1.
const BUCKETS = [30, 14, 7, 1, 0];

const DOCS = [
  { key: 'driverLicense', label: 'Permis de conduire' },
  { key: 'vehicleInsurance', label: 'Assurance véhicule' },
  { key: 'vehicleRegistration', label: 'Carte grise' },
  { key: 'vehicleInspection', label: 'Visite technique' }
];

function daysUntil(date) {
  if (!date) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function pickBucket(days) {
  if (days == null) return null;
  if (days < 0) return 0; // already expired -> "day of" bucket counts as continuous reminder
  for (const b of BUCKETS) {
    if (days <= b) return b;
  }
  return null;
}

function buildMessage(label, days, isExpired) {
  if (isExpired) {
    return {
      title: label + ' EXPIRÉ',
      body: 'Votre document a expiré. Renouvelez-le pour continuer à recevoir des courses.'
    };
  }
  if (days === 0) {
    return {
      title: label + ' expire aujourd\'hui',
      body: 'Renouvelez votre document avant minuit.'
    };
  }
  if (days === 1) {
    return {
      title: label + ' expire demain',
      body: 'Pensez à renouveler votre document dès aujourd\'hui.'
    };
  }
  return {
    title: label + ' expire dans ' + days + ' jours',
    body: 'Préparez le renouvellement pour éviter une interruption.'
  };
}

async function sendEmail(to, subject, body) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) return;
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
    });
    await transporter.sendMail({
      from: '"TeranGO" <' + process.env.EMAIL_USER + '>',
      to: to,
      subject: subject,
      text: body
    });
  } catch (e) {
    console.error('[docExpiry] email send failed:', e.message);
  }
}

async function runDailyCheck() {
  console.log('[docExpiry] Daily check starting at ' + new Date().toISOString());
  let remindersSent = 0;
  try {
    // Only check approved, non-banned drivers
    const drivers = await Driver.find({
      verificationStatus: 'approved',
      isBanned: { $ne: true },
      isSuspended: { $ne: true }
    }).populate('userId', 'name email');

    for (const driver of drivers) {
      if (!driver.userId) continue;
      const exp = driver.documentExpiry || {};
      const sentMap = driver.documentRemindersSent || new Map();

      for (const doc of DOCS) {
        const date = exp[doc.key];
        if (!date) continue;
        const days = daysUntil(date);
        const bucket = pickBucket(days);
        if (bucket == null) continue;

        const key = doc.key + ':' + bucket;
        if (sentMap.get && sentMap.get(key)) continue;
        if (sentMap[key]) continue; // safety for plain objects

        const isExpired = days < 0;
        const msg = buildMessage(doc.label, Math.max(days, 0), isExpired);

        try {
          await sendPushNotification(driver.userId._id, msg.title, msg.body, {
            type: 'doc-expiry',
            doc: doc.key,
            days: String(days)
          }, 'driver');
        } catch (e) { /* push errors logged inside */ }

        if (driver.userId.email) {
          await sendEmail(driver.userId.email, 'TeranGO - ' + msg.title, msg.body + '\n\nMise à jour: ouvrez l\'application TeranGO Pro et téléversez le document renouvelé.');
        }

        // Mark sent. Use sub-document update so atomic + survives concurrent writes.
        await Driver.updateOne(
          { _id: driver._id },
          { $set: { ['documentRemindersSent.' + key]: true } }
        );
        remindersSent++;
        console.log('[docExpiry] Reminded ' + driver.userId.name + ' about ' + doc.key + ' (' + days + ' days, bucket=' + bucket + ')');
      }
    }
  } catch (e) {
    console.error('[docExpiry] runDailyCheck error:', e.message);
  }
  console.log('[docExpiry] Daily check done. Reminders sent: ' + remindersSent);
  return remindersSent;
}

// Schedule the next 8 AM Dakar time (UTC+0). Run every 24 hours after.
function scheduleDailyCheck() {
  function msUntilNext8am() {
    const now = new Date();
    const next = new Date(now);
    next.setUTCHours(8, 0, 0, 0);
    if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
    return next.getTime() - now.getTime();
  }
  function tick() {
    runDailyCheck().catch(() => {}).finally(() => {
      setTimeout(tick, 24 * 60 * 60 * 1000);
    });
  }
  setTimeout(tick, msUntilNext8am());
  console.log('[docExpiry] Scheduled, first run in ' + Math.round(msUntilNext8am() / 60000) + ' minutes');
}

module.exports = { runDailyCheck, scheduleDailyCheck };

import * as Speech from 'expo-speech';

// Get available French female voice
let selectedVoice = null;
let speechInProgress = false;
let speechQueue = [];

const initVoice = () => {
  return new Promise(async (resolve) => {
    try {
      const voices = await Speech.getAvailableVoicesAsync();
      // Find French female voice - prefer Amelie (iOS) or any fr-FR female
      const frenchVoices = voices.filter(v => v.language.startsWith('fr'));

      // iOS female French voices: Amelie, Audrey, Aurelie
      // Android: look for female identifier
      const femaleVoice = frenchVoices.find(v =>
        v.name?.toLowerCase().includes('amelie') ||
        v.name?.toLowerCase().includes('audrey') ||
        v.name?.toLowerCase().includes('aurelie') ||
        v.identifier?.toLowerCase().includes('amelie') ||
        v.identifier?.toLowerCase().includes('female') ||
        v.name?.toLowerCase().includes('female')
      );

      if (femaleVoice) {
        selectedVoice = femaleVoice.identifier;
        console.log('Selected voice:', femaleVoice.name || femaleVoice.identifier);
      } else if (frenchVoices.length > 0) {
        // Just pick first French voice
        selectedVoice = frenchVoices[0].identifier;
        console.log('Using French voice:', frenchVoices[0].name || frenchVoices[0].identifier);
      }
    } catch (error) {
      console.log('Could not get voices:', error);
    }
    resolve();
  });
};

// Initialize on load - export the promise so other code can await it
export const voiceReady = initVoice();

// Voice configuration for a pleasant female French voice
const getVoiceConfig = () => ({
  language: 'fr-FR',
  pitch: 1.15,      // Higher pitch for female tone
  rate: 0.85,       // Slightly slower for clarity
  ...(selectedVoice ? { voice: selectedVoice } : {}),
});

// Internal speak that handles queue
const _speak = (text, config) => {
  return new Promise((resolve) => {
    speechInProgress = true;
    Speech.stop();
    Speech.speak(text, {
      ...config,
      onDone: () => {
        speechInProgress = false;
        _processQueue();
        resolve();
      },
      onError: () => {
        speechInProgress = false;
        _processQueue();
        resolve();
      },
      onStopped: () => {
        speechInProgress = false;
        resolve();
      },
    });
  });
};

// Process the next item in the queue
const _processQueue = () => {
  if (speechQueue.length > 0) {
    const next = speechQueue.shift();
    _speak(next.text, next.config);
  }
};

// Queue or speak immediately
const _queueOrSpeak = (text, config) => {
  if (speechInProgress) {
    // Replace any existing queued items - only keep the latest
    speechQueue = [{ text, config }];
  } else {
    _speak(text, config);
  }
};

// Speak with nice voice
export const speak = (text, options = {}) => {
  const config = { ...getVoiceConfig(), ...options };
  _queueOrSpeak(text, config);
};

// Speak navigation instruction (slightly faster) - waits for voice init
export const speakNavigation = async (text) => {
  await voiceReady;
  const config = { ...getVoiceConfig(), rate: 0.95 };
  _queueOrSpeak(text, config);
};

// Speak important announcement (slower, clearer)
export const speakAnnouncement = async (text) => {
  await voiceReady;
  const config = { ...getVoiceConfig(), pitch: 1.2, rate: 0.8 };
  // Announcements interrupt everything
  speechQueue = [];
  Speech.stop();
  speechInProgress = false;
  _speak(text, config);
};

// Stop speaking
export const stopSpeaking = () => {
  speechQueue = [];
  speechInProgress = false;
  Speech.stop();
};

// Check if speaking
export const isSpeaking = async () => {
  return await Speech.isSpeakingAsync();
};

// Get list of available voices (for debugging)
export const getAvailableVoices = async () => {
  return await Speech.getAvailableVoicesAsync();
};

export default {
  speak,
  speakNavigation,
  speakAnnouncement,
  stopSpeaking,
  isSpeaking,
  getAvailableVoices,
  voiceReady,
};

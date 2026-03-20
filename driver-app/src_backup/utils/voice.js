import * as Speech from 'expo-speech';

// Get available French female voice
let selectedVoice = null;

const initVoice = async () => {
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
};

// Initialize on load
initVoice();

// Voice configuration for a pleasant female French voice
const getVoiceConfig = () => ({
  language: 'fr-FR',
  pitch: 1.15,      // Higher pitch for female tone
  rate: 0.85,       // Slightly slower for clarity
  ...(selectedVoice ? { voice: selectedVoice } : {}),
});

// Speak with nice voice
export const speak = (text, options = {}) => {
  Speech.speak(text, {
    ...getVoiceConfig(),
    ...options,
  });
};

// Speak navigation instruction (slightly faster)
export const speakNavigation = (text) => {
  Speech.speak(text, {
    ...getVoiceConfig(),
    rate: 0.95,
  });
};

// Speak important announcement (slower, clearer)
export const speakAnnouncement = (text) => {
  Speech.speak(text, {
    ...getVoiceConfig(),
    pitch: 1.2,
    rate: 0.8,
  });
};

// Stop speaking
export const stopSpeaking = () => {
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
};

/**
 * Level System Test Script
 * Tests the consistency between profile command and level card displays
 */

const fs = require('fs').promises;
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

// Import required modules
const levelingSystem = require('../src/utils/levelingSystem');
const userDatabase = {
  userProfiles: new Map(),
  
  getUserProfile(userId) {
    if (!this.userProfiles.has(userId)) {
      this.userProfiles.set(userId, {
        name: 'Test User',
        level: 1,
        xp: 100,
        coins: 200
      });
    }
    return this.userProfiles.get(userId);
  },
  
  updateUserProfile(userId, data) {
    const profile = this.getUserProfile(userId);
    Object.assign(profile, data);
    return profile;
  }
};

// Mock safe message sending
const safeSendText = async (sock, jid, text) => {
  console.log(`[MOCK] Sending text to ${jid}: ${text}`);
  return true;
};

const safeSendMessage = async (sock, jid, content) => {
  console.log(`[MOCK] Sending message to ${jid}`);
  return true;
};

async function testLevelSystem() {
  console.log('Starting level system test...');
  
  const testUserId = '1234567890@s.whatsapp.net';
  
  // Initialize test user
  levelingSystem.initializeUser(testUserId);
  
  // Set user XP to a test value
  userDatabase.updateUserProfile(testUserId, { xp: 100, level: 1 });
  
  // Get level progress (used by profile command)
  const progress = levelingSystem.getLevelProgress(testUserId);
  console.log('\nProgress from getLevelProgress:');
  console.log(`Level: ${progress.currentLevel}`);
  console.log(`Current XP: ${progress.currentXP}`);
  console.log(`Required XP for next level: ${progress.requiredXP}`);
  console.log(`Progress bar: ${progress.progressBar}`);
  
  // Generate level card
  console.log('\nGenerating level card...');
  const userData = userDatabase.getUserProfile(testUserId);
  const cardPath = await levelingSystem.generateLevelCard(testUserId, userData);
  
  if (cardPath) {
    console.log(`Level card generated at: ${cardPath}`);
    
    // Simulate level-up
    console.log('\nSimulating level-up...');
    userDatabase.updateUserProfile(testUserId, { xp: 150, level: 2 });
    await levelingSystem.addXP(testUserId, 'command');
    
    // Get updated progress
    const newProgress = levelingSystem.getLevelProgress(testUserId);
    console.log('\nUpdated progress after level-up:');
    console.log(`Level: ${newProgress.currentLevel}`);
    console.log(`Current XP: ${newProgress.currentXP}`);
    console.log(`Required XP for next level: ${newProgress.requiredXP}`);
    console.log(`Progress bar: ${newProgress.progressBar}`);
    
    // Generate new level card
    console.log('\nGenerating updated level card...');
    const updatedCardPath = await levelingSystem.generateLevelCard(testUserId, userData);
    
    if (updatedCardPath) {
      console.log(`Updated level card generated at: ${updatedCardPath}`);
      console.log('\nTest completed successfully!');
    } else {
      console.error('Failed to generate updated level card');
    }
  } else {
    console.error('Failed to generate initial level card');
  }
}

// Inject necessary mocks
global.config = { bot: { language: 'en' } };
global.languageManager = {
  getText: (key, lang) => {
    const texts = {
      'user.level': 'Level',
      'user.xp': 'XP',
      'user.rank': 'Rank',
      'user.cache_hit': 'Cache hit'
    };
    return texts[key] || key;
  }
};
global.logger = {
  info: console.log,
  debug: console.log,
  error: console.error
};

// Run the test
testLevelSystem()
  .then(() => console.log('Test completed'))
  .catch(err => console.error('Test failed:', err));
#!/usr/bin/env node

// Startup script for AI Browser
// Checks environment and launches the application

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Starting AI Browser...\n');

// Check for .env file
const envPath = path.join(__dirname, '.env');
const envExamplePath = path.join(__dirname, '.env.example');

if (!fs.existsSync(envPath)) {
    console.error('❌ Error: .env file not found!');
    console.log('\nPlease create a .env file with your configuration:');
    console.log('1. Copy .env.example to .env');
    console.log('2. Add your ANTHROPIC_API_KEY\n');
    
    if (fs.existsSync(envExamplePath)) {
        console.log('Run: cp .env.example .env');
        console.log('Then edit .env and add your API key\n');
    }
    process.exit(1);
}

// Load environment variables
require('dotenv').config();

// Check for required environment variables
if (!process.env.ANTHROPIC_API_KEY) {
    console.error('❌ Error: ANTHROPIC_API_KEY not set in .env file!');
    console.log('\nTo use Claude AI, you need an API key from Anthropic:');
    console.log('1. Go to https://console.anthropic.com/');
    console.log('2. Create an account or sign in');
    console.log('3. Generate an API key');
    console.log('4. Add it to your .env file: ANTHROPIC_API_KEY=your_key_here\n');
    console.log('⚠️  Note: The browser will still work without an API key,');
    console.log('    but AI features will be limited.\n');
}

// Display configuration
console.log('📋 Configuration:');
console.log(`   Environment: ${process.env.NODE_ENV || 'production'}`);
console.log(`   Claude API: ${process.env.ANTHROPIC_API_KEY ? '✅ Configured' : '❌ Not configured'}`);
console.log(`   Debug Mode: ${process.env.DEBUG === 'true' ? 'Enabled' : 'Disabled'}`);
console.log('');

// Launch Electron
console.log('🌐 Launching browser...\n');

const electron = spawn('electron', ['.', '--dev'], {
    stdio: 'inherit',
    env: { ...process.env }
});

electron.on('close', (code) => {
    console.log(`\n👋 Browser closed with code ${code}`);
    process.exit(code);
});

electron.on('error', (err) => {
    console.error('❌ Failed to start browser:', err);
    process.exit(1);
});
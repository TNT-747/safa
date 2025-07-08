import fs from 'fs';
import path from 'path';
import { Index } from "@upstash/vector";

// File path for persistent storage (backup)
const MESSAGES_FILE = path.join(process.cwd(), 'messages.json');

// Upstash Vector Database
const index = new Index({
  url: "https://tender-asp-12545-us1-vector.upstash.io",
  token: "ABQFMHRlbmRlci1hc3AtMTI1NDUtdXMxYWRtaW5ZelV4TnpVNVpXUXRZV1k1T0MwME1EQm1MV0ZsWkRJdE5qQTJOekV5T0dNMVl6azQ=",
});

// Initialize messages file if it doesn't exist
function initializeMessagesFile() {
  if (!fs.existsSync(MESSAGES_FILE)) {
    fs.writeFileSync(MESSAGES_FILE, JSON.stringify([]));
  }
}

// Read messages from file (backup)
function readMessagesFromFile() {
  try {
    initializeMessagesFile();
    const data = fs.readFileSync(MESSAGES_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading messages file:', error);
    return [];
  }
}

// Write messages to file (backup)
function writeMessagesToFile(messages) {
  try {
    fs.writeFileSync(MESSAGES_FILE, JSON.stringify(messages, null, 2));
    return true;
  } catch (error) {
    console.error('Error writing messages file:', error);
    return false;
  }
}

// Try to get messages from Upstash, fallback to file
async function getMessagesFromDatabase() {
  try {
    console.log('Attempting to fetch messages from Upstash...');
    const result = await index.fetch(['messages_list']);
    console.log('Upstash fetch result:', result);
    
    if (result && result.length > 0 && result[0].metadata) {
      const messages = result[0].metadata.messages || [];
      console.log('Retrieved messages from Upstash:', messages.length);
      
      // Also save to file as backup
      writeMessagesToFile(messages);
      
      return messages;
    }
  } catch (upstashError) {
    console.error('Upstash error, using file backup:', upstashError);
  }
  
  // Fallback to file storage
  const fileMessages = readMessagesFromFile();
  console.log('Using file storage, messages count:', fileMessages.length);
  return fileMessages;
}

// Save messages to both Upstash and file
async function saveMessagesToDatabase(messages) {
  let savedToUpstash = false;
  
  // Try to save to Upstash first
  try {
    await index.upsert({
      id: 'messages_list',
      data: 'chat messages',
      metadata: { messages: messages }
    });
    console.log('Messages saved to Upstash successfully');
    savedToUpstash = true;
  } catch (upstashError) {
    console.error('Failed to save to Upstash:', upstashError);
  }
  
  // Always save to file as backup
  writeMessagesToFile(messages);
  console.log('Messages saved to file backup');
  
  return savedToUpstash;
}

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  console.log('API called:', req.method, req.url, req.body);
  
  // Add a simple health check endpoint
  if (req.url === '/api/messages/health') {
    const messages = await getMessagesFromDatabase();
    return res.status(200).json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      messagesCount: messages.length
    });
  }
  
  if (req.method === 'GET') {
    try {
      console.log('GET request - fetching messages...');
      const messages = await getMessagesFromDatabase();
      res.status(200).json(messages);
      
    } catch (error) {
      console.error('Error reading messages:', error);
      res.status(500).json({ error: 'Failed to fetch messages', details: error.message });
    }
  }
  
  if (req.method === 'POST') {
    try {
      const { action, message, messageId } = req.body;
      console.log('POST action:', action, 'message:', message, 'messageId:', messageId);
      
      // Get current messages from database
      let messages = await getMessagesFromDatabase();
      
      if (action === 'add') {
        const newMessage = {
          id: Date.now().toString(),
          sender: message.sender,
          text: message.text,
          timestamp: new Date().toISOString()
        };
        
        messages.push(newMessage);
        console.log('Adding message:', newMessage);
        
        // Save to both database and file
        await saveMessagesToDatabase(messages);
        res.status(200).json({ success: true, messages });
        
      } else if (action === 'edit') {
        const messageIndex = messages.findIndex(msg => msg.id === messageId);
        if (messageIndex !== -1) {
          messages[messageIndex].text = message.text;
          messages[messageIndex].editedAt = new Date().toISOString();
          
          await saveMessagesToDatabase(messages);
          console.log('Message updated successfully');
          res.status(200).json({ success: true, messages });
        } else {
          res.status(404).json({ error: 'Message not found' });
        }
        
      } else if (action === 'delete') {
        const originalLength = messages.length;
        messages = messages.filter(msg => msg.id !== messageId);
        
        if (messages.length < originalLength) {
          await saveMessagesToDatabase(messages);
          console.log('Message deleted successfully');
          res.status(200).json({ success: true, messages });
        } else {
          res.status(404).json({ error: 'Message not found' });
        }
        
      } else if (action === 'clear') {
        // Clear all messages
        await saveMessagesToDatabase([]);
        console.log('All messages cleared successfully');
        res.status(200).json({ success: true, messages: [] });
        
      } else {
        res.status(400).json({ error: 'Invalid action' });
      }
      
    } catch (error) {
      console.error('Error handling message:', error);
      res.status(500).json({ error: 'Failed to handle message: ' + error.message });
    }
  }
} 

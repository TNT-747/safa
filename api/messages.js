import fs from 'fs';
import path from 'path';

// File path for persistent storage
const MESSAGES_FILE = path.join(process.cwd(), 'messages.json');

// Initialize messages file if it doesn't exist
function initializeMessagesFile() {
  if (!fs.existsSync(MESSAGES_FILE)) {
    fs.writeFileSync(MESSAGES_FILE, JSON.stringify([]));
  }
}

// Read messages from file
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

// Write messages to file
function writeMessagesToFile(messages) {
  try {
    fs.writeFileSync(MESSAGES_FILE, JSON.stringify(messages, null, 2));
    return true;
  } catch (error) {
    console.error('Error writing messages file:', error);
    return false;
  }
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
    return res.status(200).json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      messagesCount: readMessagesFromFile().length
    });
  }
  
  if (req.method === 'GET') {
    try {
      console.log('GET request - fetching messages...');
      const messages = readMessagesFromFile();
      console.log('Retrieved messages from file:', messages.length);
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
      
      // Get current messages from file
      let messages = readMessagesFromFile();
      
      if (action === 'add') {
        const newMessage = {
          id: Date.now().toString(),
          sender: message.sender,
          text: message.text,
          timestamp: new Date().toISOString()
        };
        
        messages.push(newMessage);
        console.log('Adding message:', newMessage);
        
        // Save to file
        if (writeMessagesToFile(messages)) {
          console.log('Message saved to file successfully');
          res.status(200).json({ success: true, messages });
        } else {
          res.status(500).json({ error: 'Failed to save message to file' });
        }
        
      } else if (action === 'edit') {
        const messageIndex = messages.findIndex(msg => msg.id === messageId);
        if (messageIndex !== -1) {
          messages[messageIndex].text = message.text;
          messages[messageIndex].editedAt = new Date().toISOString();
          
          if (writeMessagesToFile(messages)) {
            console.log('Message updated in file successfully');
            res.status(200).json({ success: true, messages });
          } else {
            res.status(500).json({ error: 'Failed to update message in file' });
          }
        } else {
          res.status(404).json({ error: 'Message not found' });
        }
        
      } else if (action === 'delete') {
        const originalLength = messages.length;
        messages = messages.filter(msg => msg.id !== messageId);
        
        if (messages.length < originalLength) {
          if (writeMessagesToFile(messages)) {
            console.log('Message deleted from file successfully');
            res.status(200).json({ success: true, messages });
          } else {
            res.status(500).json({ error: 'Failed to delete message from file' });
          }
        } else {
          res.status(404).json({ error: 'Message not found' });
        }
        
      } else if (action === 'clear') {
        // Clear all messages
        if (writeMessagesToFile([])) {
          console.log('All messages cleared from file successfully');
          res.status(200).json({ success: true, messages: [] });
        } else {
          res.status(500).json({ error: 'Failed to clear messages from file' });
        }
        
      } else {
        res.status(400).json({ error: 'Invalid action' });
      }
      
    } catch (error) {
      console.error('Error handling message:', error);
      res.status(500).json({ error: 'Failed to handle message: ' + error.message });
    }
  }
} 
} 

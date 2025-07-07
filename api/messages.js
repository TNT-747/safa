const fs = require('fs');
const path = require('path');

export default function handler(req, res) {
  const messagesFile = path.join(process.cwd(), 'messages.txt');
  
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  if (req.method === 'GET') {
    try {
      if (fs.existsSync(messagesFile)) {
        const data = fs.readFileSync(messagesFile, 'utf8');
        const messages = data ? JSON.parse(data) : [];
        res.status(200).json(messages);
      } else {
        res.status(200).json([]);
      }
    } catch (error) {
      console.error('Error reading messages:', error);
      res.status(500).json({ error: 'Failed to read messages' });
    }
  }
  
  if (req.method === 'POST') {
    try {
      const { action, message, messageId } = req.body;
      
      let messages = [];
      if (fs.existsSync(messagesFile)) {
        const data = fs.readFileSync(messagesFile, 'utf8');
        messages = data ? JSON.parse(data) : [];
      }
      
      if (action === 'add') {
        messages.push({
          id: Date.now().toString(),
          sender: message.sender,
          text: message.text,
          timestamp: new Date().toISOString()
        });
      } else if (action === 'edit') {
        const messageIndex = messages.findIndex(msg => msg.id === messageId);
        if (messageIndex !== -1) {
          messages[messageIndex].text = message.text;
        }
      } else if (action === 'delete') {
        messages = messages.filter(msg => msg.id !== messageId);
      }
      
      fs.writeFileSync(messagesFile, JSON.stringify(messages, null, 2));
      res.status(200).json({ success: true, messages });
    } catch (error) {
      console.error('Error handling message:', error);
      res.status(500).json({ error: 'Failed to handle message' });
    }
  }
} 
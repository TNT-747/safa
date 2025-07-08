import { Index } from "@upstash/vector";

// Simple in-memory storage for testing
let inMemoryMessages = [];

const index = new Index({
  url: "https://tender-asp-12545-us1-vector.upstash.io",
  token: "ABQFMHRlbmRlci1hc3AtMTI1NDUtdXMxYWRtaW5ZelV4TnpVNVpXUXRZV1k1T0MwME1EQm1MV0ZsWkRJdE5qQTJOekV5T0dNMVl6azQ=",
});

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
    return res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  }
  
  if (req.method === 'GET') {
    try {
      console.log('GET request - fetching messages...');
      
      // Try Upstash first, fallback to in-memory
      try {
        const result = await index.fetch(['messages_list']);
        console.log('Upstash fetch result:', result);
        
        if (result && result.length > 0 && result[0].metadata) {
          const messages = result[0].metadata.messages || [];
          console.log('Retrieved messages from Upstash:', messages.length);
          return res.status(200).json(messages);
        }
      } catch (upstashError) {
        console.error('Upstash error, using in-memory fallback:', upstashError);
      }
      
      // Fallback to in-memory storage
      console.log('Using in-memory storage, messages count:', inMemoryMessages.length);
      res.status(200).json(inMemoryMessages);
      
    } catch (error) {
      console.error('Error reading messages:', error);
      res.status(500).json({ error: 'Failed to fetch messages', details: error.message });
    }
  }
  
  if (req.method === 'POST') {
    try {
      const { action, message, messageId } = req.body;
      console.log('POST action:', action, 'message:', message, 'messageId:', messageId);
      
      // Validate required fields
      if (!action) {
        return res.status(400).json({ error: 'Action is required' });
      }
      
      if (action === 'add' && (!message || !message.sender || !message.text)) {
        return res.status(400).json({ error: 'Message sender and text are required' });
      }
      
      if ((action === 'edit' || action === 'delete') && !messageId) {
        return res.status(400).json({ error: 'Message ID is required for edit/delete operations' });
      }
      
      // Get current messages (try Upstash first, fallback to in-memory)
      let messages = [];
      let useUpstash = true;
      
      try {
        const result = await index.fetch(['messages_list']);
        if (result && result.length > 0 && result[0].metadata) {
          messages = result[0].metadata.messages || [];
        }
      } catch (upstashError) {
        console.log('Upstash not available, using in-memory storage');
        messages = [...inMemoryMessages];
        useUpstash = false;
      }
      
      if (action === 'add') {
        const newMessage = {
          id: Date.now().toString(),
          sender: message.sender,
          text: message.text,
          timestamp: new Date().toLocaleString() // Match frontend format
        };
        
        messages.push(newMessage);
        console.log('Adding message:', newMessage);
        
        // Try to store in Upstash, fallback to in-memory
        if (useUpstash) {
          try {
            await index.upsert({
              id: 'messages_list',
              data: 'chat messages',
              metadata: { messages: messages }
            });
            console.log('Messages stored in Upstash successfully');
          } catch (upstashError) {
            console.error('Failed to store in Upstash, using in-memory:', upstashError);
            inMemoryMessages = messages;
          }
        } else {
          inMemoryMessages = messages;
          console.log('Messages stored in memory');
        }
        
        res.status(200).json({ success: true, messages });
        
      } else if (action === 'edit') {
        const messageIndex = messages.findIndex(msg => msg.id === messageId);
        if (messageIndex !== -1) {
          messages[messageIndex].text = message.text;
          messages[messageIndex].timestamp = new Date().toLocaleString(); // Update timestamp
          
          if (useUpstash) {
            try {
              await index.upsert({
                id: 'messages_list',
                data: 'chat messages',
                metadata: { messages: messages }
              });
              console.log('Message updated in Upstash successfully');
            } catch (upstashError) {
              console.error('Failed to update in Upstash:', upstashError);
              inMemoryMessages = messages;
            }
          } else {
            inMemoryMessages = messages;
            console.log('Message updated in memory');
          }
          
          res.status(200).json({ success: true, messages });
        } else {
          res.status(404).json({ error: 'Message not found' });
        }
        
      } else if (action === 'delete') {
        const messageIndex = messages.findIndex(msg => msg.id === messageId);
        if (messageIndex !== -1) {
          messages = messages.filter(msg => msg.id !== messageId);
          
          if (useUpstash) {
            try {
              await index.upsert({
                id: 'messages_list',
                data: 'chat messages',
                metadata: { messages: messages }
              });
              console.log('Message deleted from Upstash successfully');
            } catch (upstashError) {
              console.error('Failed to delete from Upstash:', upstashError);
              inMemoryMessages = messages;
            }
          } else {
            inMemoryMessages = messages;
            console.log('Message deleted from memory');
          }
          
          res.status(200).json({ success: true, messages });
        } else {
          res.status(404).json({ error: 'Message not found' });
        }
      } else {
        res.status(400).json({ error: 'Invalid action. Supported actions: add, edit, delete' });
      }
      
    } catch (error) {
      console.error('Error handling message:', error);
      res.status(500).json({ error: 'Failed to handle message: ' + error.message });
    }
  }
  
  // Handle unsupported methods
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
  }
} 

import { Index } from "@upstash/vector";

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
  
  console.log('API called:', req.method, req.body);
  
  if (req.method === 'GET') {
    try {
      // Use namespace to store all messages
      const result = await index.fetch(['messages_list']);
      console.log('Fetch result:', result);
      
      if (result && result.length > 0 && result[0].metadata) {
        const messages = result[0].metadata.messages || [];
        console.log('Retrieved messages:', messages);
        res.status(200).json(messages);
      } else {
        console.log('No messages found, returning empty array');
        res.status(200).json([]);
      }
    } catch (error) {
      console.error('Error reading messages:', error);
      res.status(200).json([]);
    }
  }
  
  if (req.method === 'POST') {
    try {
      const { action, message, messageId } = req.body;
      console.log('POST action:', action, 'message:', message, 'messageId:', messageId);
      
      // Get current messages
      let messages = [];
      try {
        const result = await index.fetch(['messages_list']);
        if (result && result.length > 0 && result[0].metadata) {
          messages = result[0].metadata.messages || [];
        }
      } catch (fetchError) {
        console.log('No existing messages found');
      }
      
      if (action === 'add') {
        const newMessage = {
          id: Date.now().toString(),
          sender: message.sender,
          text: message.text,
          timestamp: new Date().toISOString()
        };
        
        messages.push(newMessage);
        console.log('Adding message:', newMessage);
        
        // Store updated messages list
        await index.upsert({
          id: 'messages_list',
          data: 'chat messages',
          metadata: { messages: messages }
        });
        
        console.log('Messages stored successfully');
        res.status(200).json({ success: true, messages });
        
      } else if (action === 'edit') {
        const messageIndex = messages.findIndex(msg => msg.id === messageId);
        if (messageIndex !== -1) {
          messages[messageIndex].text = message.text;
          
          await index.upsert({
            id: 'messages_list',
            data: 'chat messages',
            metadata: { messages: messages }
          });
        }
        
        res.status(200).json({ success: true, messages });
        
      } else if (action === 'delete') {
        messages = messages.filter(msg => msg.id !== messageId);
        
        await index.upsert({
          id: 'messages_list',
          data: 'chat messages',
          metadata: { messages: messages }
        });
        
        res.status(200).json({ success: true, messages });
      }
      
    } catch (error) {
      console.error('Error handling message:', error);
      res.status(500).json({ error: 'Failed to handle message: ' + error.message });
    }
  }
} 

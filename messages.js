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
  
  if (req.method === 'GET') {
    try {
      // Get all messages by querying with a general term
      const results = await index.query({
        data: "chat message",
        topK: 1000, // Get up to 1000 messages
        includeVectors: false,
        includeMetadata: true,
      });
      
      // Extract messages from results and sort by timestamp
      const messages = results.map(result => result.metadata).sort((a, b) => 
        new Date(a.timestamp) - new Date(b.timestamp)
      );
      
      res.status(200).json(messages);
    } catch (error) {
      console.error('Error reading messages:', error);
      // If no messages found, return empty array
      res.status(200).json([]);
    }
  }
  
  if (req.method === 'POST') {
    try {
      const { action, message, messageId } = req.body;
      
      if (action === 'add') {
        const newMessage = {
          id: Date.now().toString(),
          sender: message.sender,
          text: message.text,
          timestamp: new Date().toISOString()
        };
        
        // Store message in vector database
        await index.upsert({
          id: newMessage.id,
          data: `${newMessage.sender}: ${newMessage.text}`, // Searchable content
          metadata: newMessage
        });
        
        // Get updated messages list
        const results = await index.query({
          data: "chat message",
          topK: 1000,
          includeVectors: false,
          includeMetadata: true,
        });
        
        const messages = results.map(result => result.metadata).sort((a, b) => 
          new Date(a.timestamp) - new Date(b.timestamp)
        );
        
        res.status(200).json({ success: true, messages });
        
      } else if (action === 'edit') {
        // Get current message
        const results = await index.query({
          data: "chat message",
          topK: 1000,
          includeVectors: false,
          includeMetadata: true,
        });
        
        const currentMessage = results.find(result => result.metadata.id === messageId);
        if (currentMessage) {
          const updatedMessage = {
            ...currentMessage.metadata,
            text: message.text
          };
          
          // Update message in vector database
          await index.upsert({
            id: messageId,
            data: `${updatedMessage.sender}: ${updatedMessage.text}`,
            metadata: updatedMessage
          });
        }
        
        // Get updated messages list
        const updatedResults = await index.query({
          data: "chat message",
          topK: 1000,
          includeVectors: false,
          includeMetadata: true,
        });
        
        const messages = updatedResults.map(result => result.metadata).sort((a, b) => 
          new Date(a.timestamp) - new Date(b.timestamp)
        );
        
        res.status(200).json({ success: true, messages });
        
      } else if (action === 'delete') {
        // Delete message from vector database
        await index.delete([messageId]);
        
        // Get updated messages list
        const results = await index.query({
          data: "chat message",
          topK: 1000,
          includeVectors: false,
          includeMetadata: true,
        });
        
        const messages = results.map(result => result.metadata).sort((a, b) => 
          new Date(a.timestamp) - new Date(b.timestamp)
        );
        
        res.status(200).json({ success: true, messages });
      }
      
    } catch (error) {
      console.error('Error handling message:', error);
      res.status(500).json({ error: 'Failed to handle message' });
    }
  }
} 

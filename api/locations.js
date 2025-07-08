import { Index } from "@upstash/vector";

// Simple in-memory storage for testing
let inMemoryLocations = [];

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
  
  console.log('Locations API called:', req.method, req.url, req.body);
  
  // Add a simple health check endpoint
  if (req.url === '/api/locations/health') {
    return res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  }
  
  if (req.method === 'GET') {
    try {
      console.log('GET request - fetching locations...');
      
      // Try Upstash first, fallback to in-memory
      try {
        const result = await index.fetch(['locations_list']);
        console.log('Upstash fetch result:', result);
        
        if (result && result.length > 0 && result[0].metadata) {
          const locations = result[0].metadata.locations || [];
          console.log('Retrieved locations from Upstash:', locations.length);
          return res.status(200).json(locations);
        }
      } catch (upstashError) {
        console.error('Upstash error, using in-memory fallback:', upstashError);
      }
      
      // Fallback to in-memory storage
      console.log('Using in-memory storage, locations count:', inMemoryLocations.length);
      res.status(200).json(inMemoryLocations);
      
    } catch (error) {
      console.error('Error reading locations:', error);
      res.status(500).json({ error: 'Failed to fetch locations', details: error.message });
    }
  }
  
  if (req.method === 'POST') {
    try {
      const { action, location, locationId } = req.body;
      console.log('POST action:', action, 'location:', location, 'locationId:', locationId);
      
      // Validate required fields
      if (!action) {
        return res.status(400).json({ error: 'Action is required' });
      }
      
      if (action === 'add' && (!location || !location.name || !location.type || !location.description || !location.date || location.x === undefined || location.y === undefined)) {
        return res.status(400).json({ error: 'Location name, type, description, date, x, and y coordinates are required' });
      }
      
      if ((action === 'edit' || action === 'delete') && !locationId) {
        return res.status(400).json({ error: 'Location ID is required for edit/delete operations' });
      }
      
      // Get current locations (try Upstash first, fallback to in-memory)
      let locations = [];
      let useUpstash = true;
      
      try {
        const result = await index.fetch(['locations_list']);
        if (result && result.length > 0 && result[0].metadata) {
          locations = result[0].metadata.locations || [];
        }
      } catch (upstashError) {
        console.log('Upstash not available, using in-memory storage');
        locations = [...inMemoryLocations];
        useUpstash = false;
      }
      
      if (action === 'add') {
        const newLocation = {
          id: Date.now().toString(),
          name: location.name,
          type: location.type,
          description: location.description,
          date: location.date,
          x: parseInt(location.x),
          y: parseInt(location.y),
          icon: location.icon || '🗼',
          createdAt: new Date().toISOString()
        };
        
        locations.push(newLocation);
        console.log('Adding location:', newLocation);
        
        // Try to store in Upstash, fallback to in-memory
        if (useUpstash) {
          try {
            await index.upsert({
              id: 'locations_list',
              data: 'love map locations',
              metadata: { locations: locations }
            });
            console.log('Locations stored in Upstash successfully');
          } catch (upstashError) {
            console.error('Failed to store in Upstash, using in-memory:', upstashError);
            inMemoryLocations = locations;
          }
        } else {
          inMemoryLocations = locations;
          console.log('Locations stored in memory');
        }
        
        res.status(200).json({ success: true, locations });
        
      } else if (action === 'edit') {
        const locationIndex = locations.findIndex(loc => loc.id === locationId);
        if (locationIndex !== -1) {
          // Update only provided fields
          if (location.name) locations[locationIndex].name = location.name;
          if (location.type) locations[locationIndex].type = location.type;
          if (location.description) locations[locationIndex].description = location.description;
          if (location.date) locations[locationIndex].date = location.date;
          if (location.x !== undefined) locations[locationIndex].x = parseInt(location.x);
          if (location.y !== undefined) locations[locationIndex].y = parseInt(location.y);
          if (location.icon) locations[locationIndex].icon = location.icon;
          
          locations[locationIndex].updatedAt = new Date().toISOString();
          
          if (useUpstash) {
            try {
              await index.upsert({
                id: 'locations_list',
                data: 'love map locations',
                metadata: { locations: locations }
              });
              console.log('Location updated in Upstash successfully');
            } catch (upstashError) {
              console.error('Failed to update in Upstash:', upstashError);
              inMemoryLocations = locations;
            }
          } else {
            inMemoryLocations = locations;
            console.log('Location updated in memory');
          }
          
          res.status(200).json({ success: true, locations });
        } else {
          res.status(404).json({ error: 'Location not found' });
        }
        
      } else if (action === 'delete') {
        const locationIndex = locations.findIndex(loc => loc.id === locationId);
        if (locationIndex !== -1) {
          locations = locations.filter(loc => loc.id !== locationId);
          
          if (useUpstash) {
            try {
              await index.upsert({
                id: 'locations_list',
                data: 'love map locations',
                metadata: { locations: locations }
              });
              console.log('Location deleted from Upstash successfully');
            } catch (upstashError) {
              console.error('Failed to delete from Upstash:', upstashError);
              inMemoryLocations = locations;
            }
          } else {
            inMemoryLocations = locations;
            console.log('Location deleted from memory');
          }
          
          res.status(200).json({ success: true, locations });
        } else {
          res.status(404).json({ error: 'Location not found' });
        }
        
      } else if (action === 'clear') {
        // Clear all locations
        locations = [];
        
        if (useUpstash) {
          try {
            await index.upsert({
              id: 'locations_list',
              data: 'love map locations',
              metadata: { locations: locations }
            });
            console.log('All locations cleared from Upstash successfully');
          } catch (upstashError) {
            console.error('Failed to clear from Upstash:', upstashError);
            inMemoryLocations = locations;
          }
        } else {
          inMemoryLocations = locations;
          console.log('All locations cleared from memory');
        }
        
        res.status(200).json({ success: true, locations });
        
      } else {
        res.status(400).json({ error: 'Invalid action. Supported actions: add, edit, delete, clear' });
      }
      
    } catch (error) {
      console.error('Error handling location:', error);
      res.status(500).json({ error: 'Failed to handle location: ' + error.message });
    }
  }
  
  // Handle unsupported methods
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
  }
} 
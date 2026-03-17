/**
 * Notion API Client Library
 * 
 * Wrapper for Notion API v1
 * https://developers.notion.com/reference
 */

const NOTION_API_VERSION = '2022-06-28';
const NOTION_API_BASE = 'https://api.notion.com/v1';

export class NotionClient {
  constructor(accessToken) {
    this.accessToken = accessToken;
  }
  
  /**
   * Make authenticated request to Notion API
   */
  async request(endpoint, method = 'GET', body = null) {
    const url = `${NOTION_API_BASE}${endpoint}`;
    
    const headers = {
      'Authorization': `Bearer ${this.accessToken}`,
      'Notion-Version': NOTION_API_VERSION,
      'Content-Type': 'application/json'
    };
    
    const options = {
      method,
      headers
    };
    
    if (body && (method === 'POST' || method === 'PATCH')) {
      options.body = JSON.stringify(body);
    }
    
    const response = await fetch(url, options);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Notion API error (${response.status}): ${errorText}`);
    }
    
    return await response.json();
  }
  
  /**
   * Create a database for client roster
   */
  async createClientsDatabase(title = 'Prime Self — Client Roster') {
    // Create database in the workspace (parent is the workspace)
    const database = await this.request('/databases', 'POST', {
      parent: {
        type: 'page_id',
        page_id: await this.getDefaultPageId()
      },
      title: [
        {
          type: 'text',
          text: { content: title }
        }
      ],
      properties: {
        'Name': {
          title: {}
        },
        'Email': {
          email: {}
        },
        'Birth Date': {
          date: {}
        },
        'Type': {
          select: {
            options: [
              { name: 'Manifestor', color: 'red' },
              { name: 'Generator', color: 'green' },
              { name: 'Manifesting Generator', color: 'yellow' },
              { name: 'Projector', color: 'blue' },
              { name: 'Reflector', color: 'purple' },
              { name: 'Unknown', color: 'gray' }
            ]
          }
        },
        'Profile': {
          rich_text: {}
        },
        'Authority': {
          select: {
            options: [
              { name: 'Emotional', color: 'orange' },
              { name: 'Sacral', color: 'green' },
              { name: 'Splenic', color: 'blue' },
              { name: 'Ego', color: 'red' },
              { name: 'Self-Projected', color: 'purple' },
              { name: 'Mental', color: 'pink' },
              { name: 'Lunar', color: 'gray' },
              { name: 'Unknown', color: 'default' }
            ]
          }
        },
        'Joined Date': {
          date: {}
        },
        'Status': {
          select: {
            options: [
              { name: 'Active', color: 'green' },
              { name: 'Inactive', color: 'gray' }
            ]
          }
        }
      }
    });
    
    return database;
  }
  
  /**
   * Create or update client page in database
   */
  async createOrUpdateClientPage(databaseId, clientData) {
    const {
      email,
      birthDate,
      type,
      profile,
      authority,
      joinedAt,
      status = 'Active'
    } = clientData;
    
    // Check if page already exists (query by email)
    const existingPages = await this.queryDatabase(databaseId, {
      filter: {
        property: 'Email',
        email: {
          equals: email
        }
      }
    });
    
    if (existingPages.results.length > 0) {
      // Update existing page
      const pageId = existingPages.results[0].id;
      return await this.updatePage(pageId, {
        'Type': {
          select: { name: type }
        },
        'Profile': {
          rich_text: [{ text: { content: profile } }]
        },
        'Authority': {
          select: { name: authority }
        },
        'Birth Date': birthDate ? {
          date: { start: birthDate }
        } : null,
        'Status': {
          select: { name: status }
        }
      });
    } else {
      // Create new page
      return await this.createPage(databaseId, {
        'Name': {
          title: [{ text: { content: email.split('@')[0] } }]
        },
        'Email': {
          email
        },
        'Birth Date': birthDate ? {
          date: { start: birthDate }
        } : null,
        'Type': {
          select: { name: type }
        },
        'Profile': {
          rich_text: [{ text: { content: profile } }]
        },
        'Authority': {
          select: { name: authority }
        },
        'Joined Date': joinedAt ? {
          date: { start: joinedAt.split('T')[0] }
        } : null,
        'Status': {
          select: { name: status }
        }
      });
    }
  }
  
  /**
   * Create a Notion page for profile export
   */
  async createProfilePage(profileData) {
    const {
      email,
      type,
      profile,
      authority,
      definition,
      strategy,
      signature,
      notSelfTheme,
      centers,
      gates,
      channels,
      synthesis
    } = profileData;
    
    const pageId = await this.getDefaultPageId();
    
    // Create page with rich content
    const page = await this.request('/pages', 'POST', {
      parent: {
        type: 'page_id',
        page_id: pageId
      },
      icon: {
        type: 'emoji',
        emoji: '✨'
      },
      properties: {
        title: {
          title: [
            {
              text: {
                content: `${email} — Energy Blueprint Profile`
              }
            }
          ]
        }
      },
      children: [
        // Header
        {
          object: 'block',
          type: 'heading_1',
          heading_1: {
            rich_text: [{ text: { content: 'Energy Blueprint Profile' } }]
          }
        },
        {
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [{ text: { content: `Generated for ${email}` } }]
          }
        },
        
        // Chart Summary
        {
          object: 'block',
          type: 'heading_2',
          heading_2: {
            rich_text: [{ text: { content: 'Chart Summary' } }]
          }
        },
        {
          object: 'block',
          type: 'bulleted_list_item',
          bulleted_list_item: {
            rich_text: [{ text: { content: `Type: ${type}` } }]
          }
        },
        {
          object: 'block',
          type: 'bulleted_list_item',
          bulleted_list_item: {
            rich_text: [{ text: { content: `Profile: ${profile}` } }]
          }
        },
        {
          object: 'block',
          type: 'bulleted_list_item',
          bulleted_list_item: {
            rich_text: [{ text: { content: `Authority: ${authority}` } }]
          }
        },
        {
          object: 'block',
          type: 'bulleted_list_item',
          bulleted_list_item: {
            rich_text: [{ text: { content: `Definition: ${definition}` } }]
          }
        },
        
        // Strategy & Signature
        {
          object: 'block',
          type: 'heading_2',
          heading_2: {
            rich_text: [{ text: { content: 'Strategy & Signature' } }]
          }
        },
        {
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [
              { text: { content: 'Strategy: ', bold: true } },
              { text: { content: strategy || 'N/A' } }
            ]
          }
        },
        {
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [
              { text: { content: 'Signature: ', bold: true } },
              { text: { content: signature || 'N/A' } }
            ]
          }
        },
        {
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [
              { text: { content: 'Not-Self Theme: ', bold: true } },
              { text: { content: notSelfTheme || 'N/A' } }
            ]
          }
        },
        
        // Centers
        {
          object: 'block',
          type: 'heading_2',
          heading_2: {
            rich_text: [{ text: { content: 'Centers' } }]
          }
        },
        ...this.createCenterBlocks(centers),
        
        // Gates
        {
          object: 'block',
          type: 'heading_2',
          heading_2: {
            rich_text: [{ text: { content: 'Activated Gates' } }]
          }
        },
        {
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [{ text: { content: gates?.join(', ') || 'None' } }]
          }
        },
        
        // Channels
        {
          object: 'block',
          type: 'heading_2',
          heading_2: {
            rich_text: [{ text: { content: 'Defined Channels' } }]
          }
        },
        {
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [{ text: { content: channels?.join(', ') || 'None' } }]
          }
        },
        
        // Synthesis
        {
          object: 'block',
          type: 'heading_2',
          heading_2: {
            rich_text: [{ text: { content: 'Profile Synthesis' } }]
          }
        },
        ...this.createSynthesisBlocks(synthesis)
      ]
    });
    
    return page;
  }
  
  /**
   * Helper: Create center blocks
   */
  createCenterBlocks(centers) {
    if (!centers) return [];
    
    const blocks = [];
    const centerNames = {
      head: 'Head',
      ajna: 'Ajna',
      throat: 'Throat',
      g: 'G/Identity',
      will: 'Will/Ego',
      spleen: 'Spleen',
      sacral: 'Sacral',
      solar: 'Solar Plexus',
      root: 'Root'
    };
    
    for (const [key, defined] of Object.entries(centers)) {
      const name = centerNames[key] || key;
      const status = defined ? '✓ Defined' : '○ Open';
      blocks.push({
        object: 'block',
        type: 'bulleted_list_item',
        bulleted_list_item: {
          rich_text: [
            { text: { content: `${name}: `, bold: true } },
            { text: { content: status } }
          ]
        }
      });
    }
    
    return blocks;
  }
  
  /**
   * Helper: Create synthesis blocks
   */
  createSynthesisBlocks(synthesis) {
    if (!synthesis) {
      return [{
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [{ text: { content: 'No synthesis available.' } }]
        }
      }];
    }
    
    // Split synthesis into paragraphs
    const paragraphs = synthesis.split('\n\n').filter(p => p.trim().length > 0);
    
    return paragraphs.map(paragraph => ({
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: [{ text: { content: paragraph.trim() } }]
      }
    }));
  }
  
  /**
   * Query database
   */
  async queryDatabase(databaseId, query = {}) {
    return await this.request(`/databases/${databaseId}/query`, 'POST', query);
  }
  
  /**
   * Create page in database
   */
  async createPage(databaseId, properties) {
    return await this.request('/pages', 'POST', {
      parent: {
        type: 'database_id',
        database_id: databaseId
      },
      properties
    });
  }
  
  /**
   * Update page properties
   */
  async updatePage(pageId, properties) {
    return await this.request(`/pages/${pageId}`, 'PATCH', {
      properties
    });
  }
  
  /**
   * Get default page ID for creating databases/pages
   * In a real integration, this would search for a specific parent page
   * or use the workspace's default location
   */
  async getDefaultPageId() {
    // Search for pages the integration has access to
    const searchResults = await this.request('/search', 'POST', {
      filter: {
        property: 'object',
        value: 'page'
      },
      page_size: 1
    });
    
    if (searchResults.results.length > 0) {
      return searchResults.results[0].id;
    }
    
    // Fallback: create in workspace root (requires different parent type)
    throw new Error('No accessible pages found. Please share a page with the Prime Self integration.');
  }
}

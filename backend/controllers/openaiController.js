import OpenAI from 'openai';
import dotenv from 'dotenv';

// Load environment variables explicitly
dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Analyze brand and generate summary
 * @route POST /api/openai/analyze-brand
 * @access Private
 */
export const analyzeBrand = async (req, res) => {
  try {
    const { brandName, websiteUrl, industry } = req.body;

    if (!brandName || !websiteUrl) {
      return res.status(400).json({
        success: false,
        message: 'Brand name and website URL are required',
      });
    }

    // Generate brand summary using OpenAI with web search for consistency
    const completion = await openai.chat.completions.create({
      model: 'gpt-5-chat-latest',
      tools: [
        {
          type: "function",
          function: {
            name: "web_search",
            description: "Search the web for current information about a brand or company",
            parameters: {
              type: "object",
              properties: {
                query: {
                  type: "string",
                  description: "Search query to find information about the brand", 
                },
                num_results: {
                  type: "integer",
                  description: "Number of search results to return",
                },
              },
              required: ["query"],
            },
          },
        },
      ],
      tool_choice: "auto",
      messages: [
        {
          role: 'system',
          content: 'You are an SEO and brand analysis expert. When you use web search, you MUST process the search results and write a professional, well-structured brand summary in proper English. Do NOT return the raw search results or JSON. Instead, analyze the information and create a coherent, fluent paragraph that reads like a professional business analysis.',
        },
        {
          role: 'user',
          content: `I need you to analyze the brand "${brandName}" with website ${websiteUrl}. 

Step 1: Use web search to find current information about this brand.
Step 2: Process all search results and combine with the provided information.
Step 3: Write a professional brand summary based on your research.

CRITICAL: Do NOT output web search results or JSON. Write a flowing, professional paragraph in proper English.

The summary should cover:
1. What the company does and its main business model
2. Target customers and market segment  
3. Key products or services
4. Industry position and competitive advantages
5. Geographic presence and scale of operations

Requirements:
- Write in proper, professional English
- Keep the summary between 150-200 words
- Format as a single, well-structured paragraph
- Be factual and accurate based on your research
- Ensure the summary flows naturally and is grammatically correct

Please provide the complete brand summary as a proper paragraph:`,
        },
      ],
      temperature: 0.3, // Lower temperature for more consistent results
      max_tokens: 500,
    });

    const summary = completion.choices[0].message.content;

    // Clean up any JSON artifacts or web search results that might appear in the response
    let cleanedSummary = summary;
    
    // Remove any JSON-like structures that might have been included
    cleanedSummary = cleanedSummary.replace(/\{[^}]*\}/g, '');
    cleanedSummary = cleanedSummary.replace(/\[[^\]]*\]/g, '');
    
    // Remove any "query" or "search results" text that might appear
    cleanedSummary = cleanedSummary.replace(/"query":\s*"[^"]*"/g, '');
    cleanedSummary = cleanedSummary.replace(/"num_results":\s*\d+/g, '');
    cleanedSummary = cleanedSummary.replace(/"results":\s*\[[^\]]*\]/g, '');
    
    // Clean up extra whitespace and ensure proper formatting
    cleanedSummary = cleanedSummary.replace(/\s+/g, ' ').trim();
    
    // Ensure it starts with a capital letter and ends with proper punctuation
    if (cleanedSummary.length > 0) {
      cleanedSummary = cleanedSummary.charAt(0).toUpperCase() + cleanedSummary.slice(1);
      if (!cleanedSummary.match(/[.!?]$/)) {
        cleanedSummary += '.';
      }
    }

    res.status(200).json({
      success: true,
      data: {
        summary: cleanedSummary,
        brandName,
        websiteUrl,
      },
    });
  } catch (error) {
    console.error('Analyze brand error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to analyze brand',
      error: error.message,
    });
  }
};

/**
 * Generate SEO categories for a brand
 * @route POST /api/openai/generate-categories
 * @access Private
 */
export const generateCategories = async (req, res) => {
  try {
    const { brandName, websiteUrl, summary } = req.body;

    if (!brandName || !websiteUrl) {
      return res.status(400).json({
        success: false,
        message: 'Brand name and website URL are required',
      });
    }

    // Generate 10 SEO categories using OpenAI with web search for consistency
    const completion = await openai.chat.completions.create({
      model: 'gpt-5-chat-latest',
      tools: [
        {
          type: "function",
          function: {
            name: "web_search",
            description: "Search the web for current information about a brand or company",
            parameters: {
              type: "object",
              properties: {
                query: {
                  type: "string",
                  description: "Search query to find information about the brand and its industry", 
                },
                num_results: {
                  type: "integer",
                  description: "Number of search results to return",
                },
              },
              required: ["query"],
            },
          },
        },
      ],
      tool_choice: "auto",
      messages: [
        {
          role: 'system',
          content: 'You are an SEO expert specializing in categorizing business types and generating relevant search categories. Use web search to verify information about brands, especially small brands. Based on your research and the provided information, generate exactly 10 distinct SEO/business categories in proper English. Categories should be professional, clear, and accurately reflect the business type.',
        },
        {
          role: 'user',
          content: `I need you to research and categorize the brand "${brandName}" (${websiteUrl}).

First, use web search to find current information about this brand to understand their actual business model and industry, especially important for small brands.

Then, based on your verified research, generate EXACTLY 10 distinct SEO/business categories that would be most relevant for this brand's online visibility and search optimization.

Requirements:
- Generate exactly 10 categories, no more, no less
- Categories must be in proper, professional English
- Each category should be clear, specific, and relevant to SEO/content strategy
- Base categories on actual business information from your research
- Examples: "E-commerce Marketplace", "Consumer Electronics", "Fashion Retail", "Home Essentials", "Online Shopping Platform", etc.

Return a valid JSON object in this EXACT format:
{
  "categories": [
    {"name": "Category Name 1", "description": "Brief description"},
    {"name": "Category Name 2", "description": "Brief description"},
    ... (10 total categories)
  ]
}

Please provide the 10 categories based on your research:`,
        },
      ],
      temperature: 0.3, // Lower temperature for more consistent results
      max_tokens: 1000,
      response_format: { type: "json_object" },
    });

    let responseContent = completion.choices[0].message.content;
    
    // Try to parse the response
    let categories = [];
    try {
      const parsed = JSON.parse(responseContent);
      
      // Handle if response has categories key (expected)
      if (parsed.categories && Array.isArray(parsed.categories)) {
        categories = parsed.categories;
      } else if (Array.isArray(parsed)) {
        // Direct array response (fallback)
        categories = parsed;
      } else {
        // Try to find any array in the object
        const values = Object.values(parsed);
        for (const value of values) {
          if (Array.isArray(value)) {
            categories = value;
            break;
          }
        }
      }

      // Validate each category has required fields
      categories = categories.filter(cat => cat.name && cat.description);
      
    } catch (parseError) {
      console.error('Raw response:', responseContent);
      
      return res.status(500).json({
        success: false,
        message: 'Failed to parse categories from AI response',
        error: parseError.message,
      });
    }

    // Ensure we have categories array
    if (!Array.isArray(categories) || categories.length === 0) {
      console.error('Parsed data:', categories);
      
      return res.status(500).json({
        success: false,
        message: 'Failed to generate categories from AI response',
      });
    }

    // If we don't have exactly 10, pad or trim
    if (categories.length < 10) {
      console.warn(`Only generated ${categories.length} categories instead of 10`);
    } else if (categories.length > 10) {
      categories = categories.slice(0, 10);
    }
    
    res.status(200).json({
      success: true,
      data: {
        categories,
        brandName,
        websiteUrl,
      },
    });
  } catch (error) {
    console.error('Generate categories error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to generate categories',
      error: error.message,
    });
  }
};

/**
 * Generate prompts based on categories
 * @route POST /api/openai/generate-prompts
 * @access Private
 */
export const generatePrompts = async (req, res) => {
  try {
    const { 
      brandName, 
      websiteUrl, 
      categories, 
      numberOfPrompts,
      searchScope,
      location,
      language 
    } = req.body;

    if (!brandName || !websiteUrl || !categories || !numberOfPrompts) {
      return res.status(400).json({
        success: false,
        message: 'Brand name, website URL, categories, and number of prompts are required',
      });
    }

    if (!Array.isArray(categories) || categories.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one category must be provided',
      });
    }

    // Distribute prompts across categories
    const promptsPerCategory = Math.floor(numberOfPrompts / categories.length);
    const extraPrompts = numberOfPrompts % categories.length;

    const allPrompts = [];

    // Generate prompts for each category
    for (let i = 0; i < categories.length; i++) {
      const category = categories[i];
      const promptCount = promptsPerCategory + (i < extraPrompts ? 1 : 0);

      // Build location context
      let locationContext = '';
      if (searchScope === 'local' && location) {
        locationContext = ` in ${location}`;
      } else if (searchScope === 'national' && location) {
        locationContext = ` in ${location}`;
      }

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an expert at generating natural, user-intent focused search queries that people would ask AI assistants like ChatGPT, Perplexity, or Google. Generate GENERIC queries that do NOT mention specific brand names. You must return a valid JSON object with a "prompts" key containing an array of strings.',
          },
          {
            role: 'user',
            content: `Generate EXACTLY ${promptCount} unique, natural search queries/prompts that potential customers would ask AI assistants when looking for products/services in the "${category.name}" category${locationContext}.

CRITICAL REQUIREMENTS:
- Generate EXACTLY ${promptCount} prompts - no more, no less
- DO NOT mention "${brandName}" or any specific brand names in the prompts
- Generate GENERIC queries that someone would ask when searching in this category
- Make queries sound natural and conversational
- Focus on user intent and real questions people would ask
- Include variety: recommendations, comparisons, "best" queries, specific needs, advice-seeking, problem-solving
- ${language !== 'English' ? `Generate queries in ${language}` : 'Use natural English'}
- Each prompt should be 5-15 words
- These prompts will be used to test which brands appear in AI responses

Examples for e-commerce:
- "What are the best online shopping platforms in India?"
- "Where can I buy electronics online with fast delivery?"
- "Which website has the best deals on fashion?"

Return a valid JSON object in this EXACT format:
{
  "prompts": ["prompt 1", "prompt 2", "prompt 3", ... ${promptCount} prompts total]
}

IMPORTANT: Generate exactly ${promptCount} prompts, no markdown, no code blocks, no brand names.`,
          },
        ],
        temperature: 0.9,
        max_tokens: 1500,
        response_format: { type: "json_object" },
      });

      let responseContent = completion.choices[0].message.content;
      
      // Parse the response
      let prompts = [];
      try {
        const parsed = JSON.parse(responseContent);
        
        // Handle if response has prompts key
        if (parsed.prompts && Array.isArray(parsed.prompts)) {
          prompts = parsed.prompts;
        } else if (Array.isArray(parsed)) {
          // Direct array response
          prompts = parsed;
        } else {
          // Try to find any array in the object
          const values = Object.values(parsed);
          for (const value of values) {
            if (Array.isArray(value)) {
              prompts = value;
              break;
            }
          }
        }        
        // Warn if we didn't get the expected number
        if (prompts.length < promptCount) {
          console.warn(`⚠️ Warning: Expected ${promptCount} prompts for "${category.name}", got ${prompts.length}`);
        }

      } catch (parseError) {
        console.error(`❌ Failed to parse prompts for category "${category.name}":`, parseError.message);
        console.error('Raw response:', responseContent);
        prompts = [];
      }

      // Ensure prompts is an array before iterating
      if (!Array.isArray(prompts)) {
        console.error(`❌ Prompts is not an array for category "${category.name}". Type:`, typeof prompts);
        prompts = [];
      }

      // Filter out any non-string prompts and add category info
      prompts.forEach((prompt) => {
        if (typeof prompt === 'string' && prompt.trim()) {
          allPrompts.push({
            text: prompt.trim(),
            category: category.name,
            categoryDescription: category.description,
          });
        }
      });
    }
    
    // Show breakdown by category
    const categoryBreakdown = {};
    allPrompts.forEach(p => {
      categoryBreakdown[p.category] = (categoryBreakdown[p.category] || 0) + 1;
    });

    res.status(200).json({
      success: true,
      data: {
        prompts: allPrompts,
        totalGenerated: allPrompts.length,
        brandName,
        websiteUrl,
      },
    });
  } catch (error) {
    console.error('Generate prompts error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate prompts',
      error: error.message,
    });
  }
};

export default {
  analyzeBrand,
  generateCategories,
  generatePrompts,
};

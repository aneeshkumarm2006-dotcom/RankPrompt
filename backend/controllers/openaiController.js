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

    // Generate brand summary using OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an SEO and brand analysis expert. Provide concise, accurate brand summaries based on the information provided.',
        },
        {
          role: 'user',
          content: `Analyze the brand "${brandName}" with website ${websiteUrl}. Provide a comprehensive summary covering:
1. What the company does and its main business model
2. Target customers and market segment
3. Key products or services
4. Industry position and competitive advantages
5. Geographic presence and scale of operations

Keep the summary between 150-200 words, professional, and factual. Format it as a single flowing paragraph.`,
        },
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    const summary = completion.choices[0].message.content;

    res.status(200).json({
      success: true,
      data: {
        summary,
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

    // Generate 10 SEO categories using OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an SEO expert specializing in categorizing business types and generating relevant search categories. You must return a valid JSON object with a "categories" key containing an array of category objects.',
        },
        {
          role: 'user',
          content: `Based on the brand "${brandName}" (${websiteUrl})${summary ? ` with the following description: ${summary}` : ''}, generate EXACTLY 10 distinct SEO/business categories that would be most relevant for this brand's online visibility and search optimization.

Return a valid JSON object in this EXACT format:
{
  "categories": [
    {"name": "Category Name 1", "description": "Brief description"},
    {"name": "Category Name 2", "description": "Brief description"},
    ... (10 total categories)
  ]
}

Make categories specific, relevant, and useful for SEO/content strategy. Examples: "E-commerce Marketplace", "Consumer Electronics", "Fashion Retail", "Home Essentials", "Online Shopping Platform", etc.

IMPORTANT: Return exactly 10 categories, no more, no less.`,
        },
      ],
      temperature: 0.7,
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
      console.log(`Trimming from ${categories.length} to 10 categories`);
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
    console.log('\nBreakdown by category:');
    Object.entries(categoryBreakdown).forEach(([cat, count]) => {
      console.log(`  - ${cat}: ${count} prompts`);
    });
    console.log('='.repeat(60) + '\n');

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

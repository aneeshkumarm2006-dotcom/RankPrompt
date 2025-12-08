import { Zap, Twitter, Linkedin, Github, Mail, Heart } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="bg-gray-50 border-t border-gray-200 py-12 sm:py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 sm:gap-10 md:gap-12 mb-8 sm:mb-12">
          {/* Brand Column */}
          <div className="space-y-4 sm:space-y-6 sm:col-span-2 md:col-span-1">
            <div className="flex items-center space-x-3 group">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-primary-500 to-accent-500 rounded-xl blur opacity-50 group-hover:opacity-75 transition-opacity"></div>
                <div className="relative bg-gradient-to-r from-primary-500 to-accent-500 p-2.5 rounded-xl">
                  <Zap className="w-6 h-6 text-white" />
                </div>
              </div>
              <span className="text-xl sm:text-2xl font-bold gradient-text">
                RankPrompt
              </span>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">
              Monitor and optimize your brand's visibility across AI search platforms like ChatGPT, Gemini, Claude, and more.
            </p>
            <div className="flex space-x-3 sm:space-x-4">
              <a href="#" className="p-2.5 bg-gray-200 rounded-lg hover:bg-gray-300 transition-all group">
                <Twitter className="w-5 h-5 text-gray-600 group-hover:text-purple-600 transition-colors" />
              </a>
              <a href="#" className="p-2.5 bg-gray-200 rounded-lg hover:bg-gray-300 transition-all group">
                <Linkedin className="w-5 h-5 text-gray-600 group-hover:text-purple-600 transition-colors" />
              </a>
              <a href="#" className="p-2.5 bg-gray-200 rounded-lg hover:bg-gray-300 transition-all group">
                <Github className="w-5 h-5 text-gray-600 group-hover:text-purple-600 transition-colors" />
              </a>
              <a href="#" className="p-2.5 bg-gray-200 rounded-lg hover:bg-gray-300 transition-all group">
                <Mail className="w-5 h-5 text-gray-600 group-hover:text-purple-600 transition-colors" />
              </a>
            </div>
          </div>

          {/* Product Column */}
          <div>
            <h3 className="text-gray-800 font-bold mb-4 sm:mb-6 text-base sm:text-lg">Product</h3>
            <ul className="space-y-2 sm:space-y-3 text-sm">
              <li><a href="#features" className="text-gray-600 hover:text-purple-600 transition-colors flex items-center space-x-2 group">
                <span className="group-hover:translate-x-1 transition-transform">Features</span>
              </a></li>
              <li><a href="#pricing" className="text-gray-600 hover:text-purple-600 transition-colors flex items-center space-x-2 group">
                <span className="group-hover:translate-x-1 transition-transform">Pricing</span>
              </a></li>
              <li><a href="#" className="text-gray-600 hover:text-purple-600 transition-colors flex items-center space-x-2 group">
                <span className="group-hover:translate-x-1 transition-transform">API</span>
              </a></li>
              <li><a href="#" className="text-gray-600 hover:text-purple-600 transition-colors flex items-center space-x-2 group">
                <span className="group-hover:translate-x-1 transition-transform">Integrations</span>
              </a></li>
              <li><a href="#" className="text-gray-600 hover:text-purple-600 transition-colors flex items-center space-x-2 group">
                <span className="group-hover:translate-x-1 transition-transform">Changelog</span>
              </a></li>
            </ul>
          </div>

          {/* Company Column */}
          <div>
            <h3 className="text-gray-800 font-bold mb-4 sm:mb-6 text-base sm:text-lg">Company</h3>
            <ul className="space-y-2 sm:space-y-3 text-sm">
              <li><a href="#" className="text-gray-600 hover:text-purple-600 transition-colors flex items-center space-x-2 group">
                <span className="group-hover:translate-x-1 transition-transform">About</span>
              </a></li>
              <li><a href="#" className="text-gray-600 hover:text-purple-600 transition-colors flex items-center space-x-2 group">
                <span className="group-hover:translate-x-1 transition-transform">Blog</span>
              </a></li>
              <li><a href="#" className="text-gray-600 hover:text-purple-600 transition-colors flex items-center space-x-2 group">
                <span className="group-hover:translate-x-1 transition-transform">Careers</span>
              </a></li>
              <li><a href="#" className="text-gray-600 hover:text-purple-600 transition-colors flex items-center space-x-2 group">
                <span className="group-hover:translate-x-1 transition-transform">Press</span>
              </a></li>
              <li><a href="#" className="text-gray-600 hover:text-purple-600 transition-colors flex items-center space-x-2 group">
                <span className="group-hover:translate-x-1 transition-transform">Partners</span>
              </a></li>
            </ul>
          </div>

          {/* Resources Column */}
          <div>
            <h3 className="text-gray-800 font-bold mb-4 sm:mb-6 text-base sm:text-lg">Resources</h3>
            <ul className="space-y-2 sm:space-y-3 text-sm">
              <li><a href="#" className="text-gray-600 hover:text-purple-600 transition-colors flex items-center space-x-2 group">
                <span className="group-hover:translate-x-1 transition-transform">Documentation</span>
              </a></li>
              <li><a href="#" className="text-gray-600 hover:text-purple-600 transition-colors flex items-center space-x-2 group">
                <span className="group-hover:translate-x-1 transition-transform">Help Center</span>
              </a></li>
              <li><a href="#" className="text-gray-600 hover:text-purple-600 transition-colors flex items-center space-x-2 group">
                <span className="group-hover:translate-x-1 transition-transform">Community</span>
              </a></li>
              <li><a href="#" className="text-gray-600 hover:text-purple-600 transition-colors flex items-center space-x-2 group">
                <span className="group-hover:translate-x-1 transition-transform">Contact</span>
              </a></li>
              <li><a href="#" className="text-gray-600 hover:text-purple-600 transition-colors flex items-center space-x-2 group">
                <span className="group-hover:translate-x-1 transition-transform">Status</span>
              </a></li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-gray-200 pt-8 flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
          <p className="text-sm text-gray-600 flex items-center space-x-2">
            <span>© 2025 RankPrompt. Made with</span>
            <Heart className="w-4 h-4 text-accent-500 fill-accent-500 animate-pulse-slow" />
            <span>for better AI search visibility</span>
          </p>
          <div className="flex space-x-6 text-sm">
            <a href="#" className="text-gray-600 hover:text-purple-600 transition-colors">Privacy Policy</a>
            <a href="#" className="text-gray-600 hover:text-purple-600 transition-colors">Terms of Service</a>
            <a href="#" className="text-gray-600 hover:text-purple-600 transition-colors">Cookie Policy</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

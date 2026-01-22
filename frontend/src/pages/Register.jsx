import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';
import { Mail, Lock, User, Zap, Eye, EyeOff, ArrowRight, Gift } from 'lucide-react';

const Register = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { register, googleLogin } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [referralCode, setReferralCode] = useState('');

  useEffect(() => {
    // Get referral code from URL
    const refCode = searchParams.get('ref');
    if (refCode) {
      setReferralCode(refCode);
    }
  }, [searchParams]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Validation
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      setLoading(false);
      return;
    }

    const { confirmPassword, ...registerData } = formData;
    
    // Include referral code if present
    const dataToSend = referralCode 
      ? { ...registerData, referralCode }
      : registerData;
    
    const result = await register(dataToSend);

    if (result.success) {
      toast.success('Account created successfully! Welcome to PromptVerse!');
      navigate('/reports/new');
    } else {
      setError(result.error);
    }
    setLoading(false);
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    setLoading(true);
    setError('');

    // Include referral code in Google signup
    const result = await googleLogin(credentialResponse.credential, referralCode);

    if (result.success) {
      toast.success('Account created successfully! Welcome to PromptVerse!');
      navigate('/reports/new');
    } else {
      setError(result.error || 'Google sign up failed');
    }
    setLoading(false);
  };

  const handleGoogleError = () => {
    setError('Google sign up failed. Please try again.');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-950 flex items-center justify-center px-4 sm:px-6 lg:px-8 relative overflow-hidden py-12">
      {/* Animated Background Elements */}
      <div className="absolute inset-0">
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary-500/10 dark:bg-primary-500/20 rounded-full blur-3xl animate-float"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-accent-500/10 dark:bg-accent-500/20 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="relative max-w-md w-full">
        {/* Logo */}
        <Link to="/" className="flex items-center justify-center space-x-3 mb-8 group">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-primary-500 to-accent-500 rounded-xl blur-lg opacity-50 group-hover:opacity-75 transition-opacity"></div>
            <div className="relative bg-gradient-to-r from-primary-500 to-accent-500 p-2.5 rounded-xl">
              <Zap className="w-6 h-6 text-white" />
            </div>
          </div>
          <span className="text-2xl font-bold gradient-text">PromptVerse</span>
        </Link>

        {/* Register Card */}
        <div className="glass-effect rounded-3xl p-8 shadow-lg dark:shadow-2xl">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-black text-gray-800 dark:text-white mb-2">Create Account</h2>
            <p className="text-gray-600 dark:text-gray-300">Start tracking your AI rankings today</p>
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-100 border border-red-200 text-red-600 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Name Field */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Full Name
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <User className="w-5 h-5 text-gray-500" />
                </div>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="w-full pl-12 pr-4 py-3 bg-white rounded-xl border border-gray-300 focus:border-[#4F46E5] focus:outline-none focus:ring-2 focus:ring-purple-200 text-gray-800 placeholder-gray-400 transition-all"
                  placeholder="John Doe"
                />
              </div>
            </div>

            {/* Email Field */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="w-5 h-5 text-gray-500" />
                </div>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className="w-full pl-12 pr-4 py-3 bg-white rounded-xl border border-gray-300 focus:border-[#4F46E5] focus:outline-none focus:ring-2 focus:ring-purple-200 text-gray-800 placeholder-gray-400 transition-all"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="w-5 h-5 text-gray-500" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  className="w-full pl-12 pr-12 py-3 bg-white dark:bg-dark-800 rounded-xl border border-gray-300 dark:border-dark-600 focus:border-action-500 focus:outline-none focus:ring-2 focus:ring-action-200 dark:focus:ring-action-500/50 text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 transition-all"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Confirm Password Field */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Confirm Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="w-5 h-5 text-gray-500" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                  className="w-full pl-12 pr-4 py-3 bg-white rounded-xl border border-gray-300 focus:border-[#4F46E5] focus:outline-none focus:ring-2 focus:ring-purple-200 text-gray-800 placeholder-gray-400 transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {/* Referral Code Field (Optional) */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Referral Code <span className="text-gray-500 dark:text-gray-400 text-xs font-normal">(Optional)</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Gift className="w-5 h-5 text-gray-500" />
                </div>
                <input
                  type="text"
                  value={referralCode}
                  onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                  className="w-full pl-12 pr-4 py-3 bg-white dark:bg-dark-800 rounded-xl border border-gray-300 dark:border-dark-600 focus:border-action-500 focus:outline-none focus:ring-2 focus:ring-action-200 dark:focus:ring-action-500/50 text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 transition-all uppercase"
                  placeholder="Enter referral code"
                  maxLength={8}
                />
              </div>
              {referralCode && (
                <p className="mt-2 text-xs text-action-500 dark:text-action-400">
                  <span className="inline-flex items-center gap-1">
                    <Gift className="w-3 h-3" />
                    You'll earn bonus credits when you sign up with this referral code!
                  </span>
                </p>
              )}
            </div>

            {/* Terms */}
            <div className="flex items-start space-x-3">
              <input
                type="checkbox"
                required
                className="mt-1 w-4 h-4 rounded border-gray-300 dark:border-dark-600 bg-gray-100 dark:bg-dark-800 text-action-600 focus:ring-2 focus:ring-action-200 dark:focus:ring-action-500/50"
              />
              <label className="text-sm text-gray-600 dark:text-gray-400">
                I agree to the{' '}
                <Link to="/terms" className="text-action-600 hover:text-action-700 dark:text-action-500 dark:hover:text-action-400">
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link to="/privacy" className="text-action-600 hover:text-action-700 dark:text-action-500 dark:hover:text-action-400">
                  Privacy Policy
                </Link>
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-action-600 text-white px-6 py-3.5 rounded-xl font-bold hover:bg-action-700 transition-all duration-300 flex items-center justify-center space-x-2"
            >
              {loading ? (
                <span>Creating account...</span>
              ) : (
                <>
                  <span>Create Account</span>
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="my-2 flex items-center">
            <div className="flex-1 border-t border-gray-200 dark:border-dark-700"></div>
            <span className="px-4 text-sm text-gray-500 dark:text-gray-400">or</span>
            <div className="flex-1 border-t border-gray-200 dark:border-dark-700"></div>
          </div>

          {/* Google Sign Up */}
          <div className="w-full flex justify-center">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={handleGoogleError}
              theme={document.documentElement.classList.contains('dark') ? 'filled_black' : 'outline'}
              size="large"
              width="100%"
              text="signup_with"
            />
          </div>

          {/* Sign In Link */}
          <p className="mt-4 text-center text-sm text-gray-600 dark:text-gray-400">
            Already have an account?{' '}
            <Link
              to="/login"
              className="text-action-600 hover:text-action-700 dark:text-action-500 dark:hover:text-action-400 font-semibold transition-colors"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;

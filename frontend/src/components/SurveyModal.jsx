import { useState } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';

const SurveyModal = ({ onClose, onComplete }) => {
  const [currentQuestion, setCurrentQuestion] = useState(1);
  const [responses, setResponses] = useState({
    question1: '',
    question2: '',
    question3: [],
    question4: '',
    question5: null,
    question6: '',
  });

  const totalQuestions = 6;

  const questions = [
    {
      id: 1,
      question: 'How are you currently using RankPrompt?',
      type: 'single',
      options: [
        'To see if my brand shows up in AI tools (ChatGPT, Perplexity, etc.)',
        'To research competitors',
        'To improve SEO visibility',
        "I'm just testing it out",
        'Other',
      ],
    },
    {
      id: 2,
      question: 'Which reporting feature would be most valuable to you?',
      type: 'single',
      options: [
        'Exportable PDF reports',
        'White-label reports (your branding)',
        'Track visibility over time',
        'Email alerts when visibility changes',
        'None of these',
      ],
    },
    {
      id: 3,
      question: 'Which AI features would be most helpful to you?',
      type: 'multiple',
      options: [
        'AI tips to improve visibility',
        'Keyword clusters based on prompt intent',
        'Prompt volume estimates',
        'Traffic breakdown from ChatGPT / Perplexity',
        'Content creation / optimization tools',
        'Add more AI sources (like Gemini, Claude, etc.)',
        'None of these',
      ],
      note: 'Select up to 3 options',
    },
    {
      id: 4,
      question: "What's the biggest thing holding you back from getting more value?",
      type: 'single',
      options: [
        "I'm not sure what to do with the results",
        'I wish it analyzed more prompts per check',
        'I want clearer action steps after each report',
        'The interface is too complex',
        "Nothing — it's working well",
        'Other',
      ],
    },
    {
      id: 5,
      question: 'How likely are you to recommend RankPrompt to a friend or colleague?',
      type: 'scale',
      min: 0,
      max: 10,
      labels: { 0: 'Not likely', 10: 'Very likely' },
    },
    {
      id: 6,
      question: 'Anything else we should build?',
      type: 'text',
      placeholder: 'Share your thoughts...',
    },
  ];

  const handleOptionSelect = (questionKey, value) => {
    if (questions[currentQuestion - 1].type === 'multiple') {
      const currentSelections = responses[questionKey] || [];
      if (currentSelections.includes(value)) {
        setResponses({
          ...responses,
          [questionKey]: currentSelections.filter((v) => v !== value),
        });
      } else if (currentSelections.length < 3) {
        setResponses({
          ...responses,
          [questionKey]: [...currentSelections, value],
        });
      }
    } else {
      setResponses({
        ...responses,
        [questionKey]: value,
      });
    }
  };

  const handleNext = () => {
    if (currentQuestion < totalQuestions) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      handleSubmit();
    }
  };

  const handleBack = () => {
    if (currentQuestion > 1) {
      setCurrentQuestion(currentQuestion - 1);
    }
  };

  const isCurrentQuestionAnswered = () => {
    const questionKey = `question${currentQuestion}`;
    const response = responses[questionKey];

    if (currentQuestion === 3) {
      return Array.isArray(response) && response.length > 0;
    } else if (currentQuestion === 5) {
      return response !== null && response !== undefined;
    } else if (currentQuestion === 6) {
      return true; // Optional question
    }
    return response && response.length > 0;
  };

  const handleSubmit = async () => {
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

      const response = await fetch(`${API_URL}/credits/survey`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ responses }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Survey submitted successfully! 50 credits have been added to your account.');
        onComplete();
      } else {
        toast.error(data.message || 'Failed to submit survey');
      }
    } catch (error) {
      console.error('Error submitting survey:', error);
      toast.error('Failed to submit survey. Please try again.');
    }
  };

  const currentQ = questions[currentQuestion - 1];
  const progress = (currentQuestion / totalQuestions) * 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-dark-900 border border-gray-200 dark:border-dark-700 rounded-2xl p-6 max-w-md w-full shadow-2xl animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex-1">
            <p className="text-primary-500 dark:text-primary-400 text-sm font-medium">
              Question {currentQuestion} of {totalQuestions}
            </p>
            <p className="text-gray-800 dark:text-gray-200 text-xs mt-1">{Math.round(progress)}%</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-200 dark:hover:bg-dark-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="w-full h-1 bg-gray-200 dark:bg-dark-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Question */}
        <div className="mb-6">
          <h3 className="text-gray-800 dark:text-white text-lg font-bold mb-4">{currentQ.question}</h3>

          {/* Single Choice / Multiple Choice */}
          {(currentQ.type === 'single' || currentQ.type === 'multiple') && (
            <div className="space-y-2">
              {currentQ.options.map((option) => {
                const questionKey = `question${currentQuestion}`;
                const isSelected = currentQ.type === 'multiple'
                  ? responses[questionKey]?.includes(option)
                  : responses[questionKey] === option;

                return (
                  <button
                    key={option}
                    onClick={() => handleOptionSelect(questionKey, option)}
                    className={`w-full text-left px-4 py-3 rounded-xl transition-all ${
                      isSelected
                        ? 'bg-purple-100 dark:bg-purple-500/10 border-2 border-primary-500 text-gray-800 dark:text-white'
                        : 'bg-white dark:bg-dark-800 border-2 border-gray-200 dark:border-dark-700 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-dark-600'
                    }`}
                  >
                    {option}
                  </button>
                );
              })}
              {currentQ.note && (
                <p className="text-gray-500 dark:text-gray-400 text-xs mt-2">{currentQ.note}</p>
              )}
            </div>
          )}

          {/* Scale (0-10) */}
          {currentQ.type === 'scale' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                {[...Array(11)].map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setResponses({ ...responses, question5: i })}
                    className={`w-10 h-10 rounded-lg font-bold transition-all ${
                      responses.question5 === i
                        ? 'bg-primary-500 text-white scale-110'
                        : 'bg-white dark:bg-dark-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-dark-700'
                    }`}
                  >
                    {i}
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-between mt-3">
                <span className="text-gray-500 dark:text-gray-400 text-xs">{currentQ.labels[0]}</span>
                <span className="text-gray-500 dark:text-gray-400 text-xs">{currentQ.labels[10]}</span>
              </div>
            </div>
          )}

          {/* Text Input */}
          {currentQ.type === 'text' && (
            <textarea
              value={responses.question6}
              onChange={(e) => setResponses({ ...responses, question6: e.target.value })}
              placeholder={currentQ.placeholder}
              rows={4}
              className="w-full px-4 py-3 bg-white dark:bg-dark-800 rounded-xl border border-gray-300 dark:border-dark-600 text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all resize-none"
            />
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={handleBack}
            disabled={currentQuestion === 1}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all ${
              currentQuestion === 1
                ? 'opacity-0 cursor-not-allowed'
                : 'bg-gray-200 dark:bg-dark-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-dark-600'
            }`}
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Back</span>
          </button>

          <button
            onClick={handleNext}
            disabled={!isCurrentQuestionAnswered()}
            className={`flex items-center space-x-2 px-6 py-3 rounded-xl font-bold transition-all ${
              isCurrentQuestionAnswered()
                ? 'bg-primary-500 text-white'
                : 'bg-gray-200 dark:bg-dark-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
            }`}
          >
            <span>{currentQuestion === totalQuestions ? 'Submit' : 'Next'}</span>
            {currentQuestion < totalQuestions && <ChevronRight className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SurveyModal;

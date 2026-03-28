import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { motion } from 'framer-motion';
import { UserPlus, User, Mail, Lock, ArrowRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const SignupPage = () => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !email || !password) {
      toast.error('Please fill in all fields');
      return;
    }

    if (password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    setIsSubmitting(true);
    const result = await register(username, email, password);
    setIsSubmitting(false);

    if (result.success) {
      toast.success('Welcome to Quarry!');
      navigate('/');
    } else {
      toast.error(result.message || 'Signup failed');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Blobs for depth */}
      <div className="absolute top-[15%] right-[10%] w-72 h-72 bg-[var(--blue)] rounded-full blur-[130px] opacity-15 animate-pulse" />
      <div className="absolute bottom-[15%] left-[10%] w-64 h-64 bg-[var(--accent)] rounded-full blur-[120px] opacity-20 animate-pulse" />

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md p-8 rounded-3xl backdrop-blur-3xl border border-[var(--glass-border)] bg-[var(--glass-bg)] shadow-[var(--glass-shadow)]"
      >
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[var(--blue-dim)] text-[var(--blue-light)] mb-4 border border-[var(--blue-dim)]">
            <UserPlus size={32} />
          </div>
          <h1 className="text-3xl font-serif font-bold text-[var(--fg-primary)]">Create Account</h1>
          <p className="text-[var(--fg-secondary)] mt-2">Start your premium research experience</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-medium text-[var(--fg-secondary)] px-1">Username</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-[var(--fg-dim)] group-focus-within:text-[var(--blue-light)] transition-colors">
                <User size={18} />
              </div>
              <input
                type="text"
                placeholder="new_researcher"
                className="w-full bg-white/5 border border-[var(--border)] rounded-2xl py-3.5 pl-12 pr-4 text-[var(--fg-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--blue-dim)] focus:border-[var(--blue-light)] transition-all placeholder:text-[var(--fg-dim)]"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-[var(--fg-secondary)] px-1">Email</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-[var(--fg-dim)] group-focus-within:text-[var(--blue-light)] transition-colors">
                <Mail size={18} />
              </div>
              <input
                type="email"
                placeholder="researcher@example.com"
                className="w-full bg-white/5 border border-[var(--border)] rounded-2xl py-3.5 pl-12 pr-4 text-[var(--fg-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--blue-dim)] focus:border-[var(--blue-light)] transition-all placeholder:text-[var(--fg-dim)]"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-[var(--fg-secondary)] px-1">Password</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-[var(--fg-dim)] group-focus-within:text-[var(--blue-light)] transition-colors">
                <Lock size={18} />
              </div>
              <input
                type="password"
                placeholder="••••••••"
                className="w-full bg-white/5 border border-[var(--border)] rounded-2xl py-3.5 pl-12 pr-4 text-[var(--fg-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--blue-dim)] focus:border-[var(--blue-light)] transition-all placeholder:text-[var(--fg-dim)]"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <p className="text-[10px] text-[var(--fg-dim)] pt-1 px-1">Min. 8 characters</p>
            </div>
          </div>

          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            type="submit"
            disabled={isSubmitting}
            className="w-full py-4 bg-[var(--blue-light)] hover:bg-[var(--blue)] text-white rounded-2xl font-semibold flex items-center justify-center space-x-2 shadow-lg shadow-[var(--blue-dim)] transition-all disabled:opacity-70 disabled:cursor-not-allowed group mt-2"
          >
            {isSubmitting ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <>
                <span>Create Account</span>
                <ArrowRight size={18} className="translate-x-0 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </motion.button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-[var(--fg-secondary)] text-sm">
            Already have an account? {' '}
            <Link to="/login" className="text-[var(--blue-light)] hover:underline font-semibold">Sign In</Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default SignupPage;

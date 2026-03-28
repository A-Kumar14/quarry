import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { motion } from 'framer-motion';
import { LogIn, User, Lock, ArrowRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const LoginPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      toast.error('Please fill in all fields');
      return;
    }

    setIsSubmitting(true);
    const result = await login(username, password);
    setIsSubmitting(false);

    if (result.success) {
      toast.success('Welcome back!');
      navigate(from, { replace: true });
    } else {
      toast.error(result.message || 'Login failed');
    }
  };

  return (
    <div style={{ fontFamily: 'var(--font-family)' }} className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-[var(--bg-primary)]">
      {/* Background Blobs for depth */}
      <div className="absolute top-[10%] left-[15%] w-64 h-64 bg-[var(--accent)] rounded-full blur-[120px] opacity-20 animate-pulse" />
      <div className="absolute bottom-[10%] right-[15%] w-80 h-80 bg-[var(--blue)] rounded-full blur-[140px] opacity-10 animate-pulse" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="w-full max-w-md p-8 rounded-3xl backdrop-blur-3xl border border-[var(--glass-border)] bg-[var(--glass-bg)] shadow-[var(--glass-shadow)]"
      >
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[var(--accent-dim)] text-[var(--accent)] mb-4 border border-[var(--accent-dim)]">
            <LogIn size={32} />
          </div>
          <h1 style={{ fontFamily: 'var(--font-serif)' }} className="text-3xl font-bold text-[var(--fg-primary)]">Welcome to Quarry</h1>
          <p className="text-[var(--fg-secondary)] mt-2 text-sm">Sign in to continue your research</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label style={{ fontFamily: 'var(--font-family)' }} className="text-sm font-medium text-[var(--fg-secondary)] px-1">Username or Email</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-[var(--fg-dim)] group-focus-within:text-[var(--accent)] transition-colors">
                <User size={18} />
              </div>
              <input
                type="text"
                placeholder="researcher_01"
                style={{ fontFamily: 'var(--font-family)' }}
                className="w-full bg-white/5 border border-[var(--border)] rounded-2xl py-3.5 pl-12 pr-4 text-[var(--fg-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-dim)] focus:border-[var(--accent)] transition-all placeholder:text-[var(--fg-dim)]"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label style={{ fontFamily: 'var(--font-family)' }} className="text-sm font-medium text-[var(--fg-secondary)] px-1">Password</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-[var(--fg-dim)] group-focus-within:text-[var(--accent)] transition-colors">
                <Lock size={18} />
              </div>
              <input
                type="password"
                placeholder="••••••••"
                style={{ fontFamily: 'var(--font-family)' }}
                className="w-full bg-white/5 border border-[var(--border)] rounded-2xl py-3.5 pl-12 pr-4 text-[var(--fg-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-dim)] focus:border-[var(--accent)] transition-all placeholder:text-[var(--fg-dim)]"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center justify-between px-1">
            <label className="flex items-center space-x-2 cursor-pointer group">
              <input type="checkbox" className="w-4 h-4 rounded border-[var(--border)] bg-transparent checked:bg-[var(--accent)] transition-all cursor-pointer" />
              <span style={{ fontFamily: 'var(--font-family)' }} className="text-sm text-[var(--fg-secondary)] group-hover:text-[var(--fg-primary)] transition-colors">Remember me</span>
            </label>
            <Link to="#" style={{ fontFamily: 'var(--font-family)' }} className="text-sm text-[var(--accent)] hover:underline font-medium">Forgot password?</Link>
          </div>

          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            type="submit"
            disabled={isSubmitting}
            style={{ fontFamily: 'var(--font-family)' }}
            className="w-full py-4 bg-[var(--accent)] hover:bg-[var(--accent)]/90 text-white rounded-2xl font-semibold flex items-center justify-center space-x-2 shadow-lg shadow-[var(--accent-dim)] transition-all disabled:opacity-70 disabled:cursor-not-allowed group"
          >
            {isSubmitting ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <>
                <span>Sign In</span>
                <ArrowRight size={18} className="translate-x-0 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </motion.button>
        </form>

        <div className="mt-8 text-center">
          <p style={{ fontFamily: 'var(--font-family)' }} className="text-[var(--fg-secondary)] text-sm">
            Don't have an account? {' '}
            <Link to="/signup" className="text-[var(--accent)] hover:underline font-semibold">Join Quarry</Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default LoginPage;

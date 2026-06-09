/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Lock, User as UserIcon, AlertCircle, ShieldAlert } from "lucide-react";
import { authenticateLocalUser } from "../db/localDb";
import { User } from "../types";
import { CachedImage } from "../components/CachedImage";

const appIcon = "https://raw.githubusercontent.com/mahbubraju30-ctrl/logos-icons/main/SalesPulse.png";

interface LoginProps {
  onLoginSuccess: (user: User) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorStatus, setErrorStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorStatus("");
    setIsSubmitting(true);

    // Simulated short verification delay for high fidelity fintech feel
    setTimeout(() => {
      const userObj = authenticateLocalUser(username, password);
      setIsSubmitting(false);
      
      if (userObj) {
        onLoginSuccess(userObj);
      } else {
        setErrorStatus("Invalid credentials. Use: admin / sp@123");
      }
    }, 850);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden select-none">
      
      {/* Decorative background glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-amber-500/5 rounded-full blur-[150px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10 transition">
        
        {/* Brand identity */}
        <div className="text-center mb-6">
          <div className="mx-auto w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg mb-3 overflow-hidden bg-slate-900 border border-slate-800">
            <CachedImage src={appIcon} cacheKey="app_icon" alt="SalesPulse Logo" className="w-full h-full object-cover" />
          </div>
          <h2 className="text-xl font-bold font-sans text-slate-100 tracking-tight">
            SalesPulse
          </h2>
          <p className="text-[10px] text-slate-500 font-mono tracking-[0.2em] uppercase mt-1.5 font-bold">
            Enterprise BI Console
          </p>
        </div>

        {/* Credentials Card container */}
        <div className="bg-slate-900/80 border border-slate-800 p-6 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-md">
          
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4 font-mono text-center">
            Sign In to Analytics Console
          </h4>

          {errorStatus && (
            <div className="p-3 mb-4 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex gap-2 items-start">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <span>{errorStatus}</span>
            </div>
          )}

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            
            {/* Username */}
            <div>
              <label className="block text-xs text-slate-400 mb-1.5 font-semibold">
                Username Profile
              </label>
              <div className="relative">
                <UserIcon size={14} className="absolute left-3 top-3 text-slate-500" />
                <input
                  id="login-username-input"
                  type="text"
                  required
                  placeholder="Enter username (e.g. admin)"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full text-xs placeholder-slate-600 pl-9 pr-3 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs text-slate-400 mb-1.5 font-semibold">
                Authorization Key / Password
              </label>
              <div className="relative">
                <Lock size={14} className="absolute left-3 top-3 text-slate-500" />
                <input
                  id="login-password-input"
                  type="password"
                  required
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full text-xs placeholder-slate-600 pl-9 pr-3 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                />
              </div>
            </div>

            {/* Action Submit */}
            <button
              id="login-submit-btn"
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-[#020617] font-bold py-2.5 rounded-lg text-xs leading-none tracking-wider uppercase transition shadow-md cursor-pointer disabled:opacity-50 mt-2"
            >
              {isSubmitting ? "Authenticating Account Keys..." : "Access Sales Portfolio"}
            </button>

          </form>

        </div>

        {/* Prepackaged Credentials Help area */}
        <div className="mt-6 p-4 rounded-xl bg-slate-900/40 border border-slate-900 border-dashed text-center select-text">
          <div className="flex items-center justify-center gap-1 text-slate-500 text-[10px] font-mono font-bold uppercase mb-2">
            <ShieldAlert size={12} />
            <span>Developer Preconfigured Logins</span>
          </div>
          <div className="flex justify-center text-[10px] font-mono text-slate-400">
            <div className="p-2 w-full max-w-[200px] rounded bg-slate-950/40 border border-slate-900">
              <span className="block text-amber-500 font-bold mb-1">Mahbub Alam (Admin)</span>
              <span>Username: admin</span><br/>
              <span>Password: sp@123</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

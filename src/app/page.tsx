"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { vaProfiles } from "@/lib/data";
import { LogIn, Shield } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [vaId, setVaId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    const profile = vaProfiles.find((v) => v.id === vaId);
    if (!profile) {
      setError("VA ID not found. Please check and try again.");
      return;
    }
    if (password !== "gyva2026") {
      setError("Invalid password.");
      return;
    }
    localStorage.setItem("vaId", vaId);
    router.push("/dashboard");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Shield className="text-white" size={32} />
          </div>
          <h1 className="text-3xl font-bold text-white">GY Virtual Support</h1>
          <p className="text-blue-300 mt-2">VA Portal</p>
        </div>

        <form
          onSubmit={handleLogin}
          className="bg-white rounded-2xl shadow-2xl p-8 space-y-5"
        >
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              VA ID
            </label>
            <input
              type="text"
              value={vaId}
              onChange={(e) => {
                setVaId(e.target.value);
                setError("");
              }}
              placeholder="e.g. 500102"
              className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError("");
              }}
              placeholder="Enter your password"
              className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
              {error}
            </p>
          )}
          <button
            type="submit"
            className="w-full bg-primary hover:bg-primary-dark text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <LogIn size={18} />
            Sign In
          </button>
          <p className="text-center text-xs text-slate-500 mt-4">
            Demo credentials: ID <strong>500102</strong> / Password{" "}
            <strong>gyva2026</strong>
          </p>
          <p className="text-center text-sm text-slate-600 mt-2">
            New VA?{" "}
            <a href="/register" className="text-blue-600 hover:underline font-medium">
              Create an account
            </a>
          </p>
          <p className="text-center text-xs text-slate-400 mt-3 pt-3 border-t border-slate-100">
            <a href="/admin" className="text-slate-500 hover:text-blue-600 hover:underline transition-colors">
              Admin Login
            </a>
          </p>
        </form>
      </div>
    </div>
  );
}

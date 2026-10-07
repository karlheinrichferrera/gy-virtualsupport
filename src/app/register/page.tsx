"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Shield, UserPlus, ArrowLeft } from "lucide-react";
import Link from "next/link";
import * as store from "@/lib/store";
import type { PendingRegistration } from "@/lib/data";

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState({
    firstName: "",
    middleName: "",
    lastName: "",
    suffix: "",
    email: "",
    phone: "",
    altPhone: "",
    street: "",
    subdivision: "",
    barangay: "",
    city: "",
    province: "",
    postalCode: "",
    position: "",
    password: "",
    confirmPassword: "",
    emergencyContact: "",
    emergencyPhone: "",
    contractorId: "",
    bankName: "",
    bankAccountNumber: "",
    bankAccountName: "",
  });
  const [error, setError] = useState("");

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError("");
  }

  function handleNext(e: React.FormEvent) {
    e.preventDefault();
    if (step === 1) {
      if (!form.firstName || !form.lastName || !form.email || !form.phone) {
        setError("Please fill in all required fields.");
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (!form.street || !form.city || !form.province) {
        setError("Please fill in all required address fields.");
        return;
      }
      setStep(3);
    } else if (step === 3) {
      if (!form.position || !form.password || !form.confirmPassword) {
        setError("Please fill in all required fields.");
        return;
      }
      if (form.password !== form.confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
      if (form.password.length < 6) {
        setError("Password must be at least 6 characters.");
        return;
      }
      const regs = store.getRegistrations();
      const nextId = `REG-${String(regs.length + 1).padStart(3, "0")}`;
      const newReg: PendingRegistration = {
        id: nextId,
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone,
        position: form.position,
        dateApplied: new Date().toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        }),
        status: "Pending",
      };
      store.saveRegistrations([...regs, newReg]);
      setSuccess(true);
    }
  }

  const inputClass =
    "w-full px-4 py-2.5 rounded-lg border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm";
  const labelClass = "block text-sm font-medium text-slate-700 mb-1";

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 px-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <UserPlus className="text-emerald-600" size={32} />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">
            Registration Submitted!
          </h2>
          <p className="text-slate-600 mb-2">
            Your account request has been submitted for admin review. You will
            receive your VA ID once approved.
          </p>
          <p className="text-sm text-slate-500 mb-6">
            Submitted name: <strong>{form.firstName} {form.lastName}</strong>
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-6 rounded-lg transition-colors"
          >
            <ArrowLeft size={16} />
            Back to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 px-4 py-8">
      <div className="w-full max-w-lg">
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Shield className="text-white" size={28} />
          </div>
          <h1 className="text-2xl font-bold text-white">New VA Registration</h1>
          <p className="text-blue-300 text-sm mt-1">
            Step {step} of 3 &mdash;{" "}
            {step === 1
              ? "Personal Info"
              : step === 2
              ? "Address"
              : "Account Setup"}
          </p>
          <div className="flex gap-2 justify-center mt-3">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-1.5 w-16 rounded-full ${
                  s <= step ? "bg-blue-400" : "bg-white/20"
                }`}
              />
            ))}
          </div>
        </div>

        <form
          onSubmit={handleNext}
          className="bg-white rounded-2xl shadow-2xl p-8 space-y-4"
        >
          {step === 1 && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>
                    First Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.firstName}
                    onChange={(e) => update("firstName", e.target.value)}
                    className={inputClass}
                    placeholder="Domingo"
                  />
                </div>
                <div>
                  <label className={labelClass}>Middle Name</label>
                  <input
                    type="text"
                    value={form.middleName}
                    onChange={(e) => update("middleName", e.target.value)}
                    className={inputClass}
                    placeholder="Munar"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>
                    Last Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.lastName}
                    onChange={(e) => update("lastName", e.target.value)}
                    className={inputClass}
                    placeholder="Soltes"
                  />
                </div>
                <div>
                  <label className={labelClass}>Suffix</label>
                  <input
                    type="text"
                    value={form.suffix}
                    onChange={(e) => update("suffix", e.target.value)}
                    className={inputClass}
                    placeholder="Jr. / Sr. / III"
                  />
                </div>
              </div>
              <div>
                <label className={labelClass}>
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => update("email", e.target.value)}
                  className={inputClass}
                  placeholder="you@email.com"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>
                    Phone <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.phone}
                    onChange={(e) => update("phone", e.target.value)}
                    className={inputClass}
                    placeholder="(+63) 912 345 6789"
                  />
                </div>
                <div>
                  <label className={labelClass}>Alternate Phone</label>
                  <input
                    type="text"
                    value={form.altPhone}
                    onChange={(e) => update("altPhone", e.target.value)}
                    className={inputClass}
                    placeholder="Optional"
                  />
                </div>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div>
                <label className={labelClass}>
                  Street Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.street}
                  onChange={(e) => update("street", e.target.value)}
                  className={inputClass}
                  placeholder="Phase 2, Blk 1 Lot 6"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Village / Subdivision</label>
                  <input
                    type="text"
                    value={form.subdivision}
                    onChange={(e) => update("subdivision", e.target.value)}
                    className={inputClass}
                    placeholder="Eco Verde Homes"
                  />
                </div>
                <div>
                  <label className={labelClass}>Barangay</label>
                  <input
                    type="text"
                    value={form.barangay}
                    onChange={(e) => update("barangay", e.target.value)}
                    className={inputClass}
                    placeholder="Santo Nino"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className={labelClass}>
                    City <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.city}
                    onChange={(e) => update("city", e.target.value)}
                    className={inputClass}
                    placeholder="San Pascual"
                  />
                </div>
                <div>
                  <label className={labelClass}>
                    Province <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.province}
                    onChange={(e) => update("province", e.target.value)}
                    className={inputClass}
                    placeholder="Batangas"
                  />
                </div>
                <div>
                  <label className={labelClass}>Postal Code</label>
                  <input
                    type="text"
                    value={form.postalCode}
                    onChange={(e) => update("postalCode", e.target.value)}
                    className={inputClass}
                    placeholder="4204"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Emergency Contact</label>
                  <input
                    type="text"
                    value={form.emergencyContact}
                    onChange={(e) => update("emergencyContact", e.target.value)}
                    className={inputClass}
                    placeholder="Full name"
                  />
                </div>
                <div>
                  <label className={labelClass}>Emergency Phone</label>
                  <input
                    type="text"
                    value={form.emergencyPhone}
                    onChange={(e) => update("emergencyPhone", e.target.value)}
                    className={inputClass}
                    placeholder="(+63) 917 123 4567"
                  />
                </div>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div>
                <label className={labelClass}>
                  Position Applying For <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.position}
                  onChange={(e) => update("position", e.target.value)}
                  className={inputClass}
                >
                  <option value="">Select a position</option>
                  <option value="Telemarketer">Telemarketer</option>
                  <option value="Sales Support">Sales Support</option>
                  <option value="Operations Support">Operations Support</option>
                  <option value="Admin Support">Admin Support</option>
                  <option value="Customer Service">Customer Service</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Contractor ID</label>
                <input
                  type="text"
                  value={form.contractorId}
                  onChange={(e) => update("contractorId", e.target.value)}
                  className={inputClass}
                  placeholder="e.g. CTR-2026-0001"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>
                    Password <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    value={form.password}
                    onChange={(e) => update("password", e.target.value)}
                    className={inputClass}
                    placeholder="Min 6 characters"
                  />
                </div>
                <div>
                  <label className={labelClass}>
                    Confirm Password <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    value={form.confirmPassword}
                    onChange={(e) => update("confirmPassword", e.target.value)}
                    className={inputClass}
                    placeholder="Re-enter password"
                  />
                </div>
              </div>
              <div className="border-t border-slate-200 pt-4 mt-2">
                <p className="text-sm font-medium text-slate-700 mb-3">Bank Information</p>
                <div className="space-y-3">
                  <div>
                    <label className={labelClass}>Bank Name</label>
                    <input
                      type="text"
                      value={form.bankName}
                      onChange={(e) => update("bankName", e.target.value)}
                      className={inputClass}
                      placeholder="e.g. BDO, BPI, Metrobank"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>Account Number</label>
                      <input
                        type="text"
                        value={form.bankAccountNumber}
                        onChange={(e) => update("bankAccountNumber", e.target.value)}
                        className={inputClass}
                        placeholder="Account number"
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Account Name</label>
                      <input
                        type="text"
                        value={form.bankAccountName}
                        onChange={(e) => update("bankAccountName", e.target.value)}
                        className={inputClass}
                        placeholder="Name on account"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                className="flex-1 border border-slate-300 text-slate-700 font-medium py-2.5 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Back
              </button>
            )}
            <button
              type="submit"
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {step === 3 ? (
                <>
                  <UserPlus size={16} />
                  Submit Registration
                </>
              ) : (
                "Continue"
              )}
            </button>
          </div>

          <p className="text-center text-xs text-slate-500">
            Already have an account?{" "}
            <Link href="/" className="text-blue-600 hover:underline font-medium">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}

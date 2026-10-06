"use client";

import { useEffect, useState } from "react";
import { getVAProfile, type VAProfile } from "@/lib/data";
import { User, Phone, MapPin, Briefcase, Heart } from "lucide-react";

export default function ProfilePage() {
  const [profile, setProfile] = useState<VAProfile | null>(null);

  useEffect(() => {
    const id = localStorage.getItem("vaId") || "";
    setProfile(getVAProfile(id) || null);
  }, []);

  if (!profile) return null;

  const addr = profile.permanentAddress;

  return (
    <div className="space-y-6 max-w-4xl">
      <h1 className="text-2xl font-bold text-foreground">My Information</h1>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 px-6 py-8">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center text-white text-2xl font-bold">
              {profile.firstName.charAt(0)}
              {profile.lastName.charAt(0)}
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">
                {profile.firstName} {profile.middleName} {profile.lastName}{" "}
                {profile.suffix}
              </h2>
              <p className="text-blue-200">VA ID: {profile.id}</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <Section icon={User} title="Personal Information">
            <Field label="First Name" value={profile.firstName} />
            <Field label="Middle Name" value={profile.middleName} />
            <Field label="Last Name" value={profile.lastName} />
            <Field label="Suffix" value={profile.suffix || "N/A"} />
            <Field label="Email" value={profile.email} />
          </Section>

          <Section icon={Phone} title="Contact Information">
            <Field label="Primary Phone" value={profile.phone} />
            <Field label="Alternate Phone" value={profile.altPhone} />
          </Section>

          <Section icon={MapPin} title="Permanent Address">
            <Field label="Street" value={addr.street} />
            <Field label="Subdivision" value={addr.subdivision} />
            <Field label="Barangay" value={addr.barangay} />
            <Field label="City / Municipality" value={addr.city} />
            <Field label="Province" value={addr.province} />
            <Field label="Postal Code" value={addr.postalCode} />
          </Section>

          <Section icon={MapPin} title="Temporary Address">
            <div className="col-span-full text-sm text-muted italic">
              {profile.temporaryAddress}
            </div>
          </Section>

          <Section icon={Briefcase} title="Employment Details">
            <Field label="Position" value={profile.position} />
            <Field label="Date Hired" value={profile.dateHired} />
            <Field label="Current Rate" value={profile.currentRate} />
          </Section>

          <Section icon={Heart} title="Emergency Contact">
            <Field label="Contact Person" value={profile.emergencyContact} />
            <Field label="Contact Number" value={profile.emergencyPhone} />
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border">
        <Icon size={18} className="text-primary" />
        <h3 className="font-semibold text-foreground">{title}</h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {children}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-xs text-muted uppercase tracking-wide">
        {label}
      </span>
      <p className="text-sm font-medium text-foreground mt-0.5">{value}</p>
    </div>
  );
}

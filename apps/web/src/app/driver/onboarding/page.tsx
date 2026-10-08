'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { ArrowLeft, Car, FileCheck, Shield, CheckCircle2 } from 'lucide-react';

export default function DriverOnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [licenseNo, setLicenseNo] = useState('');
  const [vehicleType, setVehicleType] = useState('SEDAN');
  const [make, setMake] = useState('Toyota');
  const [model, setModel] = useState('Etios');
  const [color, setColor] = useState('White');
  const [plateNo, setPlateNo] = useState('KA 01 AB 9988');
  const [year, setYear] = useState(2022);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/driver/onboarding', {
        licenseNo: licenseNo || 'DL-KA-2022-9988',
        licenseUrl: 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=200',
        rcUrl: 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=200',
        vehicle: {
          type: vehicleType,
          make,
          model,
          color,
          plateNo,
          year: Number(year),
          seats: vehicleType === 'BIKE' ? 1 : vehicleType === 'AUTO' ? 3 : 4,
        },
      });
      setSubmitted(true);
    } catch (err: any) {
      alert(err.message || 'Onboarding failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto p-4 sm:p-6 w-full space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href="/driver"
          className="p-2 rounded-2xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white flex items-center gap-1.5 text-xs font-semibold"
        >
          <ArrowLeft size={16} /> Back
        </Link>
        <h1 className="font-extrabold text-lg text-white">Captain Onboarding</h1>
        <div className="w-8" />
      </div>

      {!submitted ? (
        <form
          onSubmit={handleSubmit}
          className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6 shadow-2xl space-y-5"
        >
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
              JOIN OUR FLEET
            </span>
            <h2 className="text-xl font-black text-white mt-1">Vehicle & License Details</h2>
            <p className="text-zinc-400 text-xs mt-0.5">
              Submit your vehicle registration and license for verification.
            </p>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <label className="text-zinc-400 font-semibold mb-1 block">Driver License Number</label>
              <input
                type="text"
                value={licenseNo}
                onChange={(e) => setLicenseNo(e.target.value)}
                placeholder="DL-0420110012345"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-3 text-white focus:outline-none focus:border-emerald-500 font-mono"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-zinc-400 font-semibold mb-1 block">Vehicle Type</label>
                <select
                  value={vehicleType}
                  onChange={(e) => setVehicleType(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-3 text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="BIKE">Moto Bike</option>
                  <option value="AUTO">Auto Rickshaw</option>
                  <option value="MINI">Mini Hatchback</option>
                  <option value="SEDAN">Premier Sedan</option>
                  <option value="SUV">SUV XL</option>
                </select>
              </div>

              <div>
                <label className="text-zinc-400 font-semibold mb-1 block">License Plate Number</label>
                <input
                  type="text"
                  value={plateNo}
                  onChange={(e) => setPlateNo(e.target.value)}
                  placeholder="KA 01 AB 1234"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-3 text-white focus:outline-none focus:border-emerald-500 font-mono"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-zinc-400 font-semibold mb-1 block">Make</label>
                <input
                  type="text"
                  value={make}
                  onChange={(e) => setMake(e.target.value)}
                  placeholder="Toyota"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-3 text-white focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="text-zinc-400 font-semibold mb-1 block">Model</label>
                <input
                  type="text"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="Etios"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-3 text-white focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="text-zinc-400 font-semibold mb-1 block">Color</label>
                <input
                  type="text"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  placeholder="White"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-3 text-white focus:outline-none"
                  required
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-sm rounded-2xl transition-all shadow-lg"
          >
            {submitting ? 'Submitting Application...' : 'Submit for KYC Approval'}
          </button>
        </form>
      ) : (
        <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-8 shadow-2xl text-center flex flex-col items-center">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center mb-4">
            <CheckCircle2 size={36} />
          </div>
          <h2 className="text-2xl font-black text-white">Application Approved!</h2>
          <p className="text-zinc-400 text-xs mt-2 max-w-sm mb-6">
            Your vehicle and license have been verified. You can now toggle online and start
            receiving trip requests.
          </p>
          <button
            onClick={() => router.push('/driver')}
            className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-sm rounded-2xl shadow-lg"
          >
            Go to Driver Dashboard
          </button>
        </div>
      )}
    </div>
  );
}

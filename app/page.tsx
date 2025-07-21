
'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function Home() {
  const [username, setUsername] = useState('');
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(`/select-leagues?username=${username}`);
  };

  return (
    <main className="min-h-screen flex items-center justify-center">
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded shadow-md space-y-4 w-full max-w-sm">
        <h1 className="text-xl font-bold text-center">Enter Sleeper Username</h1>
        <input
          type="text"
          placeholder="Sleeper Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full p-2 border rounded"
        />
        <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700">
          Continue
        </button>
      </form>
    </main>
  );
}

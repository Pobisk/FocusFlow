'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Workspace() {
  const [userName, setUserName] = useState('');
  const router = useRouter();

  useEffect(() => {
    // Проверка авторизации
    const token = localStorage.getItem('access_token');
    const name = localStorage.getItem('user_name');
    
    if (!token || !name) {
      router.replace('/');
      return;
    }
    
    setUserName(name);
  }, [router]);

  return (
    <main className="min-h-screen py-8 px-4 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8 pb-4 border-b">
          <h1 className="text-2xl font-bold text-gray-900">
            Здравствуйте, {userName}! 👋
          </h1>
          <p className="text-gray-600 mt-1">
            Добро пожаловать в FocusFlow
          </p>
        </header>
        
        {/* Здесь будут последующие экраны приложения */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="p-4 bg-white rounded-lg shadow-sm border">
            <h3 className="font-medium mb-2">📋 Задачи</h3>
            <p className="text-sm text-gray-500">Скоро здесь будет список ваших задач</p>
          </div>
          <div className="p-4 bg-white rounded-lg shadow-sm border">
            <h3 className="font-medium mb-2">📊 Статистика</h3>
            <p className="text-sm text-gray-500">Аналитика вашей продуктивности</p>
          </div>
        </div>
      </div>
    </main>
  );
}

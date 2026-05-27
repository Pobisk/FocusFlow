import { LoginForm } from '@/components/LoginForm'

export function LoginPage() {
  return (
    <main
      style={{
        fontFamily: 'system-ui, -apple-system, sans-serif',
        maxWidth: '800px',
        margin: '0 auto',
        padding: '2rem',
        lineHeight: '1.6',
        color: '#333',
      }}
    >
      {/* Герой-блок */}
      <header style={{ marginBottom: '3rem', textAlign: 'center' }}>
        <h1
          style={{
            fontSize: '2.5rem',
            marginBottom: '0.5rem',
            color: '#1a1a1a',
          }}
        >
          Focus Flow
        </h1>
        <h2
          style={{
            fontSize: '1.5rem',
            fontWeight: '400',
            color: '#555',
            marginBottom: '1rem',
          }}
        >
          Личный помощник для фокусировки на целях
        </h2>
        <p
          style={{
            fontSize: '1.1rem',
            color: '#444',
            maxWidth: '600px',
            margin: '0 auto',
          }}
        >
          Планируйте задачи, отслеживайте прогресс и достигайте целей — без
          лишнего шума.
        </p>
      </header>

      {/* Секция авторизации */}
      <section className="max-w-md mx-auto bg-white p-6 rounded-xl shadow-sm border">
        <h2 className="text-xl font-semibold mb-4 text-center text-gray-900">
          Вход в систему
        </h2>
        <LoginForm />
      </section>

      {/* Футер */}
      <footer
        style={{
          paddingTop: '2rem',
          borderTop: '1px solid #eee',
          fontSize: '0.9rem',
          color: '#666',
          textAlign: 'center',
          marginTop: '3rem',
        }}
      >
        <p style={{ marginBottom: '0.5rem' }}>
          © 2026 FocusFlow. Личный помощник для фокусировки на целях.
        </p>
      </footer>
    </main>
  )
}

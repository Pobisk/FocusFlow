import LoginForm from '@/components/LoginForm';

export default function Home() {
  return (
    <main style={{ fontFamily: 'system-ui, -apple-system, sans-serif', maxWidth: '800px', margin: '0 auto', padding: '2rem', lineHeight: '1.6', color: '#333' }}>
      
      {/* Герой-блок */}
      <header style={{ marginBottom: '3rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem', color: '#1a1a1a' }}>Focus Flow</h1>
        <h2 style={{ fontSize: '1.5rem', fontWeight: '400', color: '#555', marginBottom: '1rem' }}>
          Справочный ресурс по организации рабочих процессов
        </h2>
        <p style={{ fontSize: '1.1rem', color: '#444', maxWidth: '600px', margin: '0 auto' }}>
          Здесь мы разбираем, как выстраивать понятные рабочие потоки, распределять задачи 
          и отслеживать прогресс. Простые методологии, проверенные подходы и практические 
          советы для тех, кто хочет работать осознанно и без хаоса.
        </p>
      </header>

      {/* Секция авторизации */}
      <section className="max-w-md mx-auto bg-white p-6 rounded-xl shadow-sm border">
        <h2 className="text-xl font-semibold mb-4 text-center text-gray-900">
          Вход в систему
        </h2>
        <LoginForm />
      </section>

      {/* Блок 1 */}
      <section style={{ marginBottom: '2.5rem' }}>
        <h3 style={{ fontSize: '1.3rem', marginBottom: '0.75rem', color: '#222' }}>📐 Как устроены рабочие процессы</h3>
        <p style={{ color: '#444' }}>
          Разбираем, из каких этапов состоит любая задача, как избегать потерь времени 
          и почему чёткая структура важнее скорости. Изучайте проверенные схемы 
          планирования и находите подход, который подходит именно вашей команде.
        </p>
      </section>

      {/* Блок 2 */}
      <section style={{ marginBottom: '2.5rem' }}>
        <h3 style={{ fontSize: '1.3rem', marginBottom: '0.75rem', color: '#222' }}>🎯 Планирование и контроль</h3>
        <p style={{ color: '#444' }}>
          Как ставить реалистичные сроки, отслеживать статусы задач и вовремя замечать, 
          когда процесс сбился. Собираем рабочие техники: от канбан-досок до чек-листов 
          и регулярных синхронизаций. Только то, что действительно экономит время.
        </p>
      </section>

      {/* Блок 3 */}
      <section style={{ marginBottom: '2.5rem' }}>
        <h3 style={{ fontSize: '1.3rem', marginBottom: '0.75rem', color: '#222' }}>📊 Наблюдения за процессами</h3>
        <p style={{ color: '#444' }}>
          Что измеряется, а что только кажется важным. Учимся смотреть на цифры без 
          фанатизма, выделять настоящие точки роста и постепенно делать работу 
          предсказуемой. Готовые схемы и примеры разборов типовых ситуаций.
        </p>
      </section>

      {/* Блок 4 */}
      <section style={{ marginBottom: '2.5rem' }}>
        <h3 style={{ fontSize: '1.3rem', marginBottom: '0.75rem', color: '#222' }}>🧭 Подходы и методологии</h3>
        <p style={{ color: '#444' }}>
          Кратко и по делу: что такое Agile, Scrum, Kanban и другие подходы. 
          Без воды — только суть, плюсы, минусы и случаи, когда они действительно 
          работают. Выбирайте то, что вписывается в ваш ритм, а не наоборот.
        </p>
      </section>

      {/* Для кого */}
      <section style={{ marginBottom: '3rem', padding: '1.5rem', background: '#f9f9f9', borderRadius: '8px' }}>
        <h3 style={{ fontSize: '1.3rem', marginBottom: '0.75rem', color: '#222' }}>👥 Кому пригодится</h3>
        <p style={{ color: '#444', marginBottom: '0' }}>
          Руководителям, тимлидам, аналитикам и всем, кто устал от путаницы в задачах. 
          Начните с бесплатных материалов, разберитесь в основах и соберите свою 
          систему управления процессами.
        </p>
      </section>

      {/* Футер */}
      <footer style={{ paddingTop: '2rem', borderTop: '1px solid #eee', fontSize: '0.9rem', color: '#666', textAlign: 'center' }}>
        <p style={{ marginBottom: '0.5rem' }}>© 2026 Focus Flow. Справочные материалы по организации работы.</p>
        <p style={{ margin: 0 }}>
          <a href="mailto:hello@focusflowbox.ru" style={{ color: '#666', textDecoration: 'none' }}>hello@focusflowbox.ru</a>
          {' | '}
          <a href="/privacy" style={{ color: '#666', textDecoration: 'none' }}>Политика конфиденциальности</a>
          {' | '}
          <a href="/about" style={{ color: '#666', textDecoration: 'none' }}>О проекте</a>
        </p>
      </footer>

    </main>
  );
}

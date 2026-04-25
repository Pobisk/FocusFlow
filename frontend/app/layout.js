export const metadata = {
  title: 'FocusFlow',
  description: 'HelloWorld page',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}

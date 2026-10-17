import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { getStoredValue, setStoredValue } from '@/lib/safe-storage';

export type Language = 'en' | 'es';

const LANGUAGE_STORAGE_KEY = 'FUTURERECEIPT_LANGUAGE';

const spanish: Record<string, string> = {
  'FUTURERECEİPT home': 'Inicio de FUTURERECEİPT',
  'Zero Paper, Zero Spam.': 'Cero papel, cero spam.',
  'Digital Receipt For a Green Future.': 'Recibos digitales para un futuro verde.',
  'How it works': 'Cómo funciona',
  'For businesses': 'Para empresas',
  'Our impact': 'Nuestro impacto',
  'Sign in': 'Iniciar sesión',
  'Get started': 'Comenzar',
  'receipts, rethought': 'recibos, reinventados',
  'Proof of purchase, without the paper.': 'Tu comprobante de compra, sin papel.',
  "A clear, private place for every receipt you earn. Scan the merchant's screen to claim your purchase. Know what you bought, where it came from, and what your choices are saving.": 'Un espacio privado y organizado para todos tus recibos. Escanea la pantalla del comercio para guardar tu compra y descubre qué compraste, dónde y cuánto papel ahorraste.',
  'Create your free account': 'Crea tu cuenta gratis',
  'I already use FUTURERECEİPT': 'Ya uso FUTURERECEİPT',
  'Private by design': 'Privado desde el diseño',
  'Less waste, more clarity': 'Menos residuos, más claridad',
  'Scanner active': 'Escáner activo',
  'Ready': 'Listo',
  'Waiting for receipt': 'Esperando un recibo',
  'Point at POS screen.': 'Apunta a la pantalla del POS.',
  'scanning': 'escaneando',
  'zero paper / zero spam': 'cero papel / cero spam',
  'paper saved this year': 'papel ahorrado este año',
  'one small switch': 'un pequeño cambio',
  'The receipt you can actually trust.': 'Un recibo en el que puedes confiar.',
  'Scan to claim': 'Escanea para guardar',
  "Point your phone at the merchant's screen to securely claim your purchase. No email hunting, no paper slip.": 'Apunta tu teléfono a la pantalla del comercio para guardar tu compra de forma segura. Sin buscar correos ni guardar tickets de papel.',
  'Get it instantly': 'Recíbelo al instante',
  'Your receipt lands in your private history before your bag leaves the counter.': 'Tu recibo llega a tu historial privado antes de salir del comercio.',
  'See the story': 'Descubre el impacto',
  'Understand your spending and the paper, trees, and carbon you kept in the ground.': 'Consulta tus gastos y el papel, los árboles y las emisiones que ayudaste a evitar.',
  'for businesses worldwide': 'para empresas de todo el mundo',
  'A better last step at the register.': 'Un mejor cierre para cada compra.',
  'FUTURERECEİPT keeps your team moving. Send a verified receipt in a few taps, while your customers get a calmer record of every purchase.': 'FUTURERECEİPT ayuda a tu equipo a seguir avanzando. Envía un recibo verificado en unos toques y ofrece a tus clientes un registro claro de cada compra.',
  'Set up your business': 'Configura tu empresa',
  'One focused POS flow. More time for people.': 'Un flujo de POS sencillo. Más tiempo para atender.',
  'No new hardware. No complicated back office. Just a receipt workflow your staff will remember after one use.': 'Sin equipos nuevos ni sistemas complicados. Solo un proceso de recibos que tu equipo aprenderá enseguida.',
  'Built for trust': 'Diseñado para generar confianza',
  'Every receipt gets a verification code customers can check.': 'Cada recibo incluye un código de verificación que tus clientes pueden consultar.',
  'Show your impact': 'Muestra tu impacto',
  'Turn paper saved into a story your customers can see and share.': 'Convierte el papel ahorrado en una historia que tus clientes puedan ver y compartir.',
  'the promise': 'nuestro compromiso',
  'Zero paper, zero spam.': 'Cero papel, cero spam.',
  'Digital Receipt For a Green Future. Clear records for real life.': 'Recibos digitales para un futuro verde. Registros claros para la vida real.',
  'a little less waste, every day': 'un poco menos de residuos cada día',
  'Goodbye Paper Receipts, Hello Green Future.': 'Adiós a los recibos de papel. Hola, futuro verde.',
  'Beta Version - Free to Use': 'Versión beta: gratis',
  "FUTURERECEİPT is currently in its Open Beta phase and is free to use. Features may change, be unavailable, or contain errors while we test and improve the platform. This service is provided 'as is' without any financial liabilities. We do not process payments or store sensitive financial data.": 'FUTURERECEİPT está en fase beta abierta y es gratis. Las funciones pueden cambiar, no estar disponibles o contener errores mientras probamos y mejoramos la plataforma. El servicio se ofrece tal cual y no asumimos responsabilidades financieras. No procesamos pagos ni almacenamos datos financieros confidenciales.',
  'your account': 'tu cuenta',
  'Welcome': 'Te damos la bienvenida',
  'FUTURERECEİPT Customer ID': 'ID de cliente de FUTURERECEİPT',
  'Overview': 'Resumen',
  'Register Simulator / QR': 'Simulador de caja / QR',
  'Digital Receipts History': 'Historial de recibos digitales',
  'Sales Analytics': 'Análisis de ventas',
  'Home': 'Inicio',
  'Scan receipt': 'Escanear recibo',
  'My receipts': 'Mis recibos',
  'Spending & impact': 'Gastos e impacto',
  'Store Config': 'Configuración de tienda',
  'Profile settings': 'Configuración del perfil',
  'Good to see you,': 'Qué bueno verte,',
  'Your data is private': 'Tus datos son privados',
  'Sign out': 'Cerrar sesión',
  'Receipt not found': 'No se encontró el recibo',
  'This receipt may have moved or the link is incorrect.': 'Es posible que el recibo se haya movido o que el enlace no sea correcto.',
  'Back to receipts': 'Volver a los recibos',
  'All receipts': 'Todos los recibos',
  'Print / Save Paper Copy': 'Imprimir / Guardar copia',
  'Delete': 'Eliminar',
  'SUBTOTAL': 'SUBTOTAL',
  'TAX': 'IMPUESTO',
  'TOTAL': 'TOTAL',
  'CARD PAID': 'TARJETA PAGADA',
  'CARD': 'TARJETA',
  'TENDER': 'PAGO',
  'CHANGE RETURNED': 'CAMBIO ENTREGADO',
  'RECORD': 'REGISTRO',
  'MANUAL': 'MANUAL',
  'APPR CODE': 'CÓDIGO DE AUTORIZACIÓN',
  'TOTAL PURCHASE': 'TOTAL DE LA COMPRA',
  'ACCOUNT': 'CUENTA',
  'REF #': 'N.º DE REFERENCIA',
  'NETWORK ID.': 'ID DE RED',
  'TERMINAL #': 'N.º DE TERMINAL',
  'CUSTOMER COPY': 'COPIA DEL CLIENTE',
  'Saved {amount}g of paper today.': 'Hoy ahorraste {amount} g de papel.',
  'Thank you for helping save our green planet.': 'Gracias por ayudar a cuidar nuestro planeta.',
  'Delete receipt?': '¿Eliminar recibo?',
  'This removes the receipt from your FUTURERECEİPT history. The merchant record remains available.': 'Esto eliminará el recibo de tu historial de FUTURERECEİPT. El comercio conservará su registro.',
  'This permanently removes this receipt from your merchant records.': 'Esto eliminará permanentemente el recibo de los registros de tu comercio.',
  'Cancel': 'Cancelar',
  'Deleting...': 'Eliminando...',
  'Delete receipt': 'Eliminar recibo',
  'Could not delete this receipt. Please try again.': 'No se pudo eliminar el recibo. Inténtalo de nuevo.',
  'Manager: {name}': 'Gerente: {name}',
  'Language': 'Idioma',
  'Español': 'Español',
  'Your receipts are waiting.': 'Tus recibos te esperan.',
  'Welcome back': 'Te damos la bienvenida',
  'Join FUTURERECEİPT': 'Únete a FUTURERECEİPT',
  'How would you like to use FUTURERECEİPT?': '¿Cómo quieres usar FUTURERECEİPT?',
  'Sign in to your FUTURERECEİPT account.': 'Inicia sesión en tu cuenta de FUTURERECEİPT.',
  'Existing accounts will automatically open in their saved role.': 'Las cuentas existentes abrirán automáticamente el perfil guardado.',
  'For Customers': 'Para clientes',
  'A clear, private place for every receipt you earn. Understand your spending and see what your choices are saving.': 'Un espacio privado y organizado para tus recibos. Comprende tus gastos y descubre el impacto de tus decisiones.',
  'Store digital receipts': 'Guarda recibos digitales',
  'Track spending habits': 'Sigue tus hábitos de gasto',
  'Measure eco-impact': 'Mide tu impacto ambiental',
  'Create personal account': 'Crear una cuenta personal',
  'Customer sign in': 'Iniciar sesión como cliente',
  'For Businesses': 'Para empresas',
  'A better last step at the register. Send verified digital receipts in a few taps and reduce your thermal paper costs.': 'Un mejor cierre para cada compra. Envía recibos digitales verificados en unos toques y reduce el gasto en papel térmico.',
  'POS QR integration': 'Integración con QR del POS',
  'Digital receipt history': 'Historial de recibos digitales',
  'Sales analytics': 'Análisis de ventas',
  'Set up business account': 'Crear cuenta de empresa',
  'Business sign in': 'Iniciar sesión como empresa',
  'Already have an account? ': '¿Ya tienes una cuenta? ',
  "Don't have an account yet? ": '¿Aún no tienes una cuenta? ',
  'Create an account': 'Crear una cuenta',
  'Choose a different account type': 'Elegir otro tipo de cuenta',
  'Business account': 'Cuenta de empresa',
  'Customer account': 'Cuenta de cliente',
  'Terms of Service': 'Términos del servicio',
  'Privacy Policy': 'Política de privacidad',
  'Please accept the Terms of Service and Privacy Policy before signing up.': 'Acepta los términos del servicio y la política de privacidad antes de registrarte.',
  '← Back to sign up': '← Volver al registro',
  'Open Beta': 'Beta abierta',
  'Open Beta / Educational Project': 'Beta abierta / Proyecto educativo',
  'Testing purpose': 'Propósito de las pruebas',
  'FUTURERECEİPT is currently in an Open Beta for testing. Features may change, be unavailable, or contain errors.': 'FUTURERECEİPT se encuentra actualmente en una beta abierta para pruebas. Las funciones pueden cambiar, no estar disponibles o contener errores.',
  'Use of the platform': 'Uso de la plataforma',
  'You agree to use FUTURERECEİPT lawfully and understand that receipt records and environmental estimates are provided for informational purposes only.': 'Aceptas usar FUTURERECEİPT de forma legal y entiendes que los recibos y las estimaciones ambientales se ofrecen solo con fines informativos.',
  'No financial services': 'Sin servicios financieros',
  'FUTURERECEİPT does not process payments, move money, or provide financial advice. The platform is provided “as is” without financial liabilities.': 'FUTURERECEİPT no procesa pagos, transfiere dinero ni ofrece asesoramiento financiero. La plataforma se ofrece «tal cual» y sin responsabilidades financieras.',
  'Information we use': 'Información que usamos',
  'FUTURERECEİPT uses account details and receipt information needed to provide digital receipt history, spending insights, and environmental estimates.': 'FUTURERECEİPT usa los datos de tu cuenta y de tus recibos para ofrecer un historial digital, información sobre gastos y estimaciones ambientales.',
  'Sensitive financial data': 'Datos financieros confidenciales',
  'FUTURERECEİPT does not process payments or store full card numbers, CVVs, PINs, or other sensitive payment credentials. Only limited receipt details supplied by the merchant may be shown.': 'FUTURERECEİPT no procesa pagos ni almacena números completos de tarjetas, CVV, PIN u otras credenciales de pago confidenciales. Solo se muestran algunos datos del recibo proporcionados por el comercio.',
  'Your choices': 'Tus opciones',
  'You can manage privacy preferences from Profile Settings and request account deletion from the app.': 'Puedes administrar tus preferencias de privacidad en la configuración del perfil y solicitar la eliminación de tu cuenta desde la aplicación.',
  'ST#': 'TIENDA N.º',
  'OP#': 'OPERADOR N.º',
  'TE#': 'TERMINAL N.º',
  'TR#': 'TRANSACCIÓN N.º',
  'TC#': 'CÓDIGO TC',
  'ID:': 'ID:',
  'Checking your session…': 'Comprobando tu sesión…',
  'Please wait while we restore your account.': 'Espera mientras restauramos tu cuenta.',
  'Loading your account…': 'Cargando tu cuenta…',
  'No active session': 'No hay una sesión activa',
  'Sign in to continue.': 'Inicia sesión para continuar.',
  'Could not load your account': 'No se pudo cargar tu cuenta',
  'Check your connection and try again.': 'Comprueba tu conexión e inténtalo de nuevo.',
  'Retry': 'Reintentar',
  'Back to home': 'Volver al inicio',
  'Could not sign out right now. Please try again.': 'No se pudo cerrar la sesión. Inténtalo de nuevo.',
};

type LanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function translate(language: Language, text: string): string {
  if (language === 'en') return text;
  return spanish[text] ?? text;
}

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used within LanguageProvider');
  return context;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    return getStoredValue(LANGUAGE_STORAGE_KEY) === 'es' ? 'es' : 'en';
  });

  const setLanguage = (nextLanguage: Language) => {
    setStoredValue(LANGUAGE_STORAGE_KEY, nextLanguage);
    setLanguageState(nextLanguage);
  };

  useEffect(() => {
    document.documentElement.lang = language;
    const title = language === 'es' ? 'FUTURERECEİPT Recibos Digitales' : 'FUTURERECEİPT Digital Receipts';
    const description = language === 'es'
      ? 'Recibos digitales e información de gastos para consumidores y empresas de todo el mundo. Los importes se muestran en USD y el impuesto usa una tasa de ventas de EE. UU.'
      : 'Digital receipts and spending insights for shoppers and businesses worldwide. Values are shown in USD; merchant tax uses a manually entered U.S. sales-tax rate.';
    document.title = title;
    document.querySelector('meta[name="description"]')?.setAttribute('content', description);
    document.querySelector('meta[property="og:title"]')?.setAttribute('content', title);
    document.querySelector('meta[property="og:description"]')?.setAttribute('content', description);
    document.querySelector('meta[name="twitter:title"]')?.setAttribute('content', title);
    document.querySelector('meta[name="twitter:description"]')?.setAttribute('content', description);
  }, [language]);

  return <LanguageContext.Provider value={{ language, setLanguage }}>{children}</LanguageContext.Provider>;
}

export function LanguageSwitcher({ className = '' }: { className?: string }) {
  const { language, setLanguage } = useLanguage();

  return (
    <div className={`inline-flex items-center rounded-xl border border-border bg-card p-1 text-xs font-semibold ${className}`} role="group" aria-label={translate(language, 'Language')}>
      <button
        type="button"
        onClick={() => setLanguage('en')}
        aria-pressed={language === 'en'}
        className={`rounded-lg px-2.5 py-1.5 transition ${language === 'en' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => setLanguage('es')}
        aria-label="Español"
        aria-pressed={language === 'es'}
        className={`rounded-lg px-2.5 py-1.5 transition ${language === 'es' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
      >
        ES <span className="hidden sm:inline">Español</span>
      </button>
    </div>
  );
}
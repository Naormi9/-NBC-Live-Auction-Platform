'use client';

import Navbar from '@/components/ui/Navbar';

export default function TermsPage() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-black mb-8">תקנון מכרז מיכאלי מוטורס</h1>

        <div className="glass rounded-2xl p-8 space-y-6 text-text-secondary leading-relaxed">
          <section>
            <h2 className="text-xl font-bold text-white mb-3">1. כללי</h2>
            <p>
              תקנון זה מסדיר את תנאי ההשתתפות במכרזי הרכבים המקוונים של מיכאלי מוטורס
              (להלן: &quot;החברה&quot;), המתקיימים באתר auction.m-motors.co.il (להלן: &quot;האתר&quot;).
            </p>
            <p className="mt-2">
              ההשתתפות במכרז מהווה הסכמה מלאה לתנאי תקנון זה. על המשתתף לקרוא תקנון זה
              בעיון רב לפני ההרשמה.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">2. תנאי השתתפות</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>ההשתתפות מותנית בהרשמה מלאה הכוללת: שם מלא, מספר ת&quot;ז, טלפון, אימייל וחתימה דיגיטלית.</li>
              <li>המשתתף חייב להיות בן 18 ומעלה.</li>
              <li>אישור ההשתתפות מותנה באימות זהות ואמצעי תשלום תקף, או באישור ידני של החברה.</li>
              <li>החברה רשאית לסרב לבקשת השתתפות ללא מתן נימוקים.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">3. מהלך המכרז</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>המכרז מתנהל בשלושה סבבים עם מדרגות הצעה שונות לכל סבב.</li>
              <li>כל הצעה היא מחייבת ובלתי חוזרת.</li>
              <li>הטיימר מתאפס עם כל הצעה חדשה.</li>
              <li>החברה שומרת לעצמה את הזכות לסגור/לבטל לוט בכל עת.</li>
              <li>צפייה במכרז חי פתוחה לכולם; הגשת הצעות מותנית באישור מראש.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">4. זכייה ותשלום</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>הזוכה במכרז מתחייב לסיים את העסקה תוך 3 ימי עסקים.</li>
              <li>הסגירה הכספית והעברת המסמכים יתבצעו מול החברה ישירות.</li>
              <li>הרכב נמכר כמות שהוא (&quot;AS IS&quot;), למעט אם צוין אחרת.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">5. אי-תשלום וקנסות</h2>
            <p>
              במקרה שזוכה לא ישלם את סכום הזכייה בהתאם לתנאים, החברה שומרת לעצמה
              את הזכות לגבות פיצוי בגובה 10% מסכום הזכייה, בהתאם לתנאי תקנון זה
              ולחוק החוזים.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">6. אחריות</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>החברה אינה אחראית לתקלות טכניות, ניתוקים או עיכובים שאינם בשליטתה.</li>
              <li>החברה שומרת לעצמה את הזכות לבטל מכרז או לוט בנסיבות חריגות.</li>
              <li>המידע באתר ניתן &quot;כמות שהוא&quot; ואינו מהווה ייעוץ מקצועי.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">7. פרטיות</h2>
            <p>
              פרטי המשתתפים נשמרים באופן מאובטח ולא יועברו לצדדים שלישיים, למעט
              כנדרש על פי חוק. פרטי אמצעי תשלום אינם נשמרים במערכת — האימות מתבצע
              דרך ספק תשלומים מאושר בלבד.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">8. יצירת קשר</h2>
            <p>
              לשאלות ובירורים ניתן לפנות אלינו:
            </p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>אימייל: office@m-motors.co.il</li>
              <li>אתר: m-motors.co.il</li>
            </ul>
          </section>

          <div className="border-t border-border pt-4 text-xs text-text-secondary/60">
            <p>תקנון זה עודכן לאחרונה: מרץ 2026</p>
            <p className="mt-1 text-yellow-500/70">* תקנון זה הוא טיוטה ראשונית ויעודכן לפני עלייה לפרודקשן בליווי ייעוץ משפטי.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

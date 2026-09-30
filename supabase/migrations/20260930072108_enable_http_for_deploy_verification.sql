-- כלי אימות פריסה.
--
-- סביבת העבודה של Claude חסומה ליציאה אל *.vercel.app, ולכן אי אפשר לבדוק
-- מתוכה את האתר החי. מסד הנתונים אינו חסום, ולכן הבדיקה נעשית ממנו:
-- הרחבת http מאפשרת לשלוף את הדף מהייצור ולבדוק מה יש בו בפועל.
--
-- ההרחבה מותקנת בסכמה extensions, והרשאת ההרצה נשללת מהתפקידים הציבוריים
-- כדי שאף גולש לא יוכל להשתמש בשרת כדי לפנות לכתובות אחרות.

create extension if not exists http with schema extensions;

revoke all on all functions in schema extensions from anon, authenticated;

-- תמונה אחת לכל קול.
--
-- קול הוא דעה אחת של תושב אחד, והתמונה היא הראיה שלה. כמה תמונות על
-- אותו קול אינן מוסיפות דעה — הן רק גורמות לתושב אחד להיראות כמו כמה.
-- ברוגוזין נוצרו כך 5 תמונות על קול אחד: כל שליחה חוזרת של הדירוג עם
-- תמונה הוסיפה שורה, והקודמות נשארו.
--
-- מכאן זה נאכף במסד ולא רק בקוד: שליחה חוזרת מחליפה את התמונה של הקול.

-- ----------------------------------------------- ניקוי מה שכבר נוצר
-- התמונות הישנות אינן נמחקות. הן תמונות אמיתיות של הרחוב, והן נשארות
-- בגלריה — רק מנותקות מהקול, כך שהקול נושא אחת בלבד. התמונה שנשארת
-- מחוברת היא זו שהקול עצמו מצביע עליה, ואם אין כזו — האחרונה.
update public.photos p
   set vote_id = null
 where p.vote_id is not null
   and p.id <> (
     select coalesce(
       (select v.photo_id from public.votes v where v.id = p.vote_id),
       (select p2.id from public.photos p2
         where p2.vote_id = p.vote_id
         order by p2.created_at desc, p2.id
         limit 1)
     )
   );

-- ----------------------------------------------- האכיפה עצמה
create unique index if not exists photos_one_per_vote
  on public.photos (vote_id)
  where vote_id is not null;

-- ----------------------------------------------- החלפה אפשרית
-- כדי שהחלפה תעבוד, התושב צריך למחוק את התמונה הקודמת שלו — גם אחרי
-- שאושרה. זו התמונה שלו, והסרת תרומה משלו אינה עוקפת את המודרציה:
-- המודרציה חוסמת פרסום, היא אינה מעבירה בעלות על התמונה לאגף.
drop policy if exists photos_delete on public.photos;
create policy photos_delete on public.photos for delete to authenticated
  using (public.is_staff() or created_by = auth.uid());

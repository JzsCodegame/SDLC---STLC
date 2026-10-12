const entry=document.querySelector('.practice-entry');
if(entry){const link=document.createElement('a');link.id='quiz-guide-launch';link.className='quiz-guide-launch';link.href='quiz-guide.html';link.textContent='Read the illustrated quiz guide →';entry.querySelector('.section-heading').after(link);}

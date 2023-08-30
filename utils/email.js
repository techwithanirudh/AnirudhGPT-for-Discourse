import sg from '@sendgrid/mail';
import { TO_EMAIL_ADDRESS, FROM_EMAIL_ADDRESS, SENDGRID_API_KEY } from '../config';

sg.setApiKey(SENDGRID_API_KEY);

async function sendEmail(content, subject) {
  if (typeof content === 'undefined' || content.trim() === '') {
   throw 'Please enter some content for the email.'
  }

  const msg = {
    to: TO_EMAIL_ADDRESS,
    from: { email: FROM_EMAIL_ADDRESS, name: 'AutoMod for Discourse' },
    replyTo: FROM_EMAIL_ADDRESS,
    subject: `[automod] ${subject || ''}`.trim(),
    text: content,
  };

  try {
    await sg.send(msg);
  } catch (error) {
    console.error(error);
    let { message } = error;
    if (error.response) {
      console.error(error.response.body);
      message = error.response.body.errors[0];
    }
    throw message;
  }
}

export { sendEmail };
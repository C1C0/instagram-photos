import dotenv from 'dotenv';

dotenv.config();

console.log('Starting AUTH process');

const authURL = 'https://api.instagram.com/oauth/authorize?';
const authQuery = `client_id=${process.env.CLIENT_ID}&redirect_uri=${process.env.FORWARD_URL}&scope=instagram_graph_user_profile,instagram_graph_user_media&response_type=code`;

console.log('pre-requset', authURL, authQuery);

const response = await fetch(authURL + authQuery);
const body = await response.body;

console.log(response, body, 'Ending AUTH Process');
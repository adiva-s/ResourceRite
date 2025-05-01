# ResourceRite

ResourceRite is a web application that serves as an equitable marketplace connecting stores, digital learning companies, individual sellers, and customers for discounted educational resources. 

## Features
- Secure authentication with Google and email-based sign-ups/sign-ins.
- Secure payment gateways using Stripe.
- Amazon-style cart feature: Add items, adjust quantities, delete items, proceed to checkout.
- User and admin functionalities for managing inventory and product listings.

## Technologies
- Node.js
- Express
- Handlebars
- Stripe API
- MongoDB

## Installation
1. Clone repo and install dependencies
```bash
git clone https://github.com/YOUR-USERNAME/ResourceRite.git
cd ResourceRite
npm install
```
2. Set up MongoDB
You’ll need MongoDB running locally or use MongoDB Atlas.
If local:
Install MongoDB (https://www.mongodb.com/try/download/community)
Start MongoDB server:
```bash
mongod
```
Or if using MongoDB Atlas:
Get your connection string from your cluster.
Update your .env file:
``` bash
MONGO_URI=mongodb://localhost:27017/resource_rite
```
3. Configure your .env file:
Create a .env file in the root folder:
``` bash
MONGO_URI=your_mongo_uri_here
STRIPE_SECRET_KEY=your_stripe_secret_key_here
EMAIL_USER=your_email_here@gmail.com
EMAIL_PASS=your_email_app_password_here
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
```
You’ll need to generate:
Stripe Secret Key → from https://dashboard.stripe.com/test/apikeys
Google OAuth Client ID/Secret → from Google Cloud Console (enable OAuth, authorized redirect http://localhost:3000/auth/google/callback)

5. Start the App
``` bash
node app.mjs
```


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

3. Install Stripe/Google Dependencies (in case needed_
```bash
npm install stripe passport-google-oauth20
```

4. Start the App
``` bash
node app.mjs
```


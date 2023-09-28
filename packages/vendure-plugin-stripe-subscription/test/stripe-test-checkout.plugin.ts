import { PluginCommonModule, VendurePlugin } from '@vendure/core';
import { Body, Controller, Get, Headers, Res } from '@nestjs/common';
import { Response } from 'express';
import { clientSecret } from './dev-server';

/**
 * Return the Stripe intent checkout page
 */
@Controller()
export class CheckoutController {
  @Get('checkout')
  async webhook(
    @Headers('stripe-signature') signature: string | undefined,
    @Res() res: Response,
    @Body() body: any
  ): Promise<void> {
    res.send(`
<head>
  <title>Checkout</title>
  <script src="https://js.stripe.com/v3/"></script>
</head>
<html>

<form id="payment-form">
  <div id="payment-element">
    <!-- Elements will create form elements here -->
  </div>
  <button id="submit">Submit</button>
  <div id="error-message">
    <!-- Display error message to your customers here -->
  </div>
</form>

<script>
// Set your publishable key: remember to change this to your live publishable key in production
// See your keys here: https://dashboard.stripe.com/apikeys
const stripe = Stripe('${process.env.STRIPE_PUBLISHABLE_KEY}');
const options = {
  clientSecret: '${clientSecret}',
  // Fully customizable with appearance API.
  appearance: {/*...*/},
};

// Set up Stripe.js and Elements to use in checkout form, passing the client secret obtained in step 3
const elements = stripe.elements(options);

// Create and mount the Payment Element
const paymentElement = elements.create('payment');
paymentElement.mount('#payment-element');
const form = document.getElementById('payment-form');

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  // const {error} = await stripe.confirmSetup({
  const {error} = await stripe.confirmPayment({
    //\`Elements\` instance that was used to create the Payment Element
    elements,
    confirmParams: {
      return_url: 'http://localhost:3050/checkout?success=true',
    }
  });

  if (error) {
    // This point will only be reached if there is an immediate error when
    // confirming the payment. Show error to your customer (for example, payment
    // details incomplete)
    const messageContainer = document.querySelector('#error-message');
    messageContainer.textContent = error.message;
  } else {
    // Your customer will be redirected to your \`return_url\`. For some payment
    // methods like iDEAL, your customer will be redirected to an intermediate
    // site first to authorize the payment, then redirected to the \`return_url\`.
  }
});
</script>
</html>
    `);
  }
}

/**
 * Test plugin for serving the Stripe intent checkout page
 */
@VendurePlugin({
  imports: [PluginCommonModule],
  controllers: [CheckoutController],
})
export class StripeTestCheckoutPlugin {}

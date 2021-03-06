const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const User = require('../models/userModel');
const Tour = require('../models/tourModel');
const Booking = require('../models/bookingModel');
const catchAsync = require('../utils/catchAsync');
const factory = require('./handlerFactory');
const AppError = require('../utils/appError');
const Email = require('../utils/email');

exports.createBooking = factory.createOne(Booking);
exports.getBooking = factory.getOne(Booking);
exports.getAllBookings = factory.getAll(Booking);
exports.updateBooking = factory.updateOne(Booking);
exports.deleteBooking = factory.deleteOne(Booking);

/**
 * Middleware to check if the current user has actually booked a tour
 * This prevents a user from writing a review without booking.
 */
exports.checkIfBooked = catchAsync(async (req, res, next) => {
  const booking = await Booking.findOne(req.body);
  if (!booking) {
    const message = 'You must book a tour to write a review';
    return next(new AppError(message, 400));
  }
  next();
});

/**
 * Middleware that creates a checkout session used for Stripe online payments.
 * Sends back the session as a resposnse.
 */
exports.createCheckoutSession = catchAsync(async (req, res, next) => {
  // 1) Get tour
  const { tourId, dateId } = req.params;
  const maxGroupSize = (await Tour.findById(tourId)).maxGroupSize;
  const tour = await Tour.findOne({
    _id: tourId,
    startDates: {
      $elemMatch: { _id: dateId, participants: { $lte: maxGroupSize } },
    },
  });
  const date = tour.startDates.find((el) => el.id === dateId);

  // 2) Check if the tour date is available
  if (date.participants >= maxGroupSize) {
    throw new AppError('The date you chose is not available.', 400);
  }

  // 3) Create checkout session
  const domain = `${req.protocol}://${req.header('host')}`;
  const dateStr = new Date(date.date).toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    success_url: `${domain}/my-bookings?alert=booking`,
    cancel_url: `${domain}/tour/${tour.slug}`,
    customer_email: req.user.email,
    client_reference_id: Object.values(req.params).join('/'),
    line_items: [
      {
        name: `${tour.name} Tour (date: ${dateStr})`,
        description: tour.summary,
        images: [`${domain}/img/tours/${tour.imageCover}`],
        amount: tour.price * 100,
        currency: 'usd',
        quantity: 1,
      },
    ],
  });

  // 4) Response
  res.status(200).json({
    status: 'success',
    session,
  });
});

/**
 * Webhook to be automatically notified from Stripe that a checkout has been
 * completed, and creates a booking
 */
exports.webhookCheckout = catchAsync(async (req, res, next) => {
  const payload = req.body;
  const signature = req.header('stripe-signature');
  let event;

  // Validate a session
  try {
    event = stripe.webhooks.constructEvent(
      payload,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return res.status(400).send(`Webhook error: ${err.message}`);
  }

  const session = event.data.object;
  const user = await User.findOne({ email: session.customer_email });
  const email = new Email(user, '');

  try {
    // fulfill the order
    await fulfillOrder(session, user);
  } catch (err) {
    // if fails to fulfill the order, refund the payment
    await stripe.refunds.create({ payment_intent: session.payment_intent });

    // and notify the user by email that his booking failed
    email.sendBookingFail();

    // respond to Stripe server with error message
    return res.status(400).send(`Booking failed: ${err.message}`);
  }

  // Everything went well
  // Send an email that the tour has been successfully booked
  email.sendBookingSuccess();

  res.status(200).json({ received: true });
});

const fulfillOrder = async (session, user) => {
  // 1) Get tour and date ID
  const [tourId, dateId] = session.client_reference_id.split('/');

  // 2) Get maxGroupSize
  const maxGroupSize = (await Tour.findById(tourId)).maxGroupSize;

  // 3) Perform atomic update to avoid concurrency
  const updated = await Tour.findOneAndUpdate(
    {
      _id: tourId,
      startDates: {
        $elemMatch: { _id: dateId, participants: { $ne: maxGroupSize } },
      },
    },
    { $inc: { 'startDates.$.participants': 1 } }
  );

  if (!updated) {
    throw new AppError('The date you chose is not available.', 400);
  }

  // 4) Create a booking
  const price = session.amount_total / 100;
  await Booking.create({ tour: tourId, date: dateId, user: user.id, price });
};

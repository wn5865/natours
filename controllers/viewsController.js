const Tour = require('../models/tourModel');
const User = require('../models/userModel');
const Booking = require('../models/bookingModel');
const Review = require('../models/reviewModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const Bookmark = require('../models/bookmarkModel');
const { toDateString, addDateString } = require('../utils/date');

/**
 * Sets an alert message used in template engine
 */
exports.alerts = (req, res, next) => {
  const { alert } = req.query;
  if (alert === 'booking') {
    res.locals.alert = `Your payment was successful!
      If your booking doesn't show up here immediately, please check your email for confirmation.`;
  }
  next();
};

/**
 * Gets all tours and render overview page
 */
exports.getOverview = catchAsync(async (req, res, next) => {
  // Get all tours
  const tours = await Tour.find();

  // Convert a date to string, and add it as a field
  addDateString(tours);

  // Render tours
  res.status(200).render('overview', {
    title: 'All tours',
    tours,
  });
});

/**
 * Gets bookmarks and render them
 */
exports.getMyBookmarks = catchAsync(async (req, res, next) => {
  // Get bookmarks first and get tours from them
  const user = req.user._id;
  const tours = (await Bookmark.find({ user }).populate('tour')).map(
    (bookmark) => bookmark.tour
  );

  // Convert a date to string, and add it as a field
  addDateString(tours);

  // Render tours
  res.status(200).render('overview', {
    title: 'Bookmarks',
    tours,
  });
});

/**
 * Gets all bookings of current user and render 'My Bookings' page
 */
exports.getMyBookings = catchAsync(async (req, res, next) => {
  // Get all bookings and then dates from bookings
  const bookings = await Booking.find({ user: req.user.id });
  const dateIDs = bookings.map((booking) => booking.date);

  // Find tours with the date IDs
  const tours = await Tour.aggregate([
    { $unwind: '$startDates' },
    { $match: { 'startDates._id': { $in: dateIDs } } },
  ]);

  // Convert a date to string, and add it as a field
  addDateString(tours, 'booking');

  res.status(200).render('overlayCards', {
    title: 'My tours',
    tours,
    role: 'user',
  });
});

/**
 * Gets a tour and render tour detail page
 */
exports.getTour = catchAsync(async (req, res, next) => {
  // 1) Get the tour
  let tour = await Tour.findOne({ slug: req.params.slug }).populate({
    path: 'reviews',
    fields: 'review rating user createdAt',
    options: { sort: { createdAt: -1 } },
  });

  if (!tour) {
    const message = 'There is no tour with that name';
    return next(new AppError(message, 404));
  }

  let bookmark;
  // 2) If logged in,
  if (req.user) {
    const IDs = { tour: tour._id, user: req.user._id };

    // 2-1) remove tour dates that was already booked by user or sold out
    const bookings = await Booking.find(IDs);
    const dateIDs = bookings.map((booking) => booking.date.toString());
    tour.startDates = tour.startDates
      .filter((date) => date.participants < tour.maxGroupSize)
      .filter((date) => !dateIDs.includes(date.id));

    // 2-2) check if this tour is bookmarked
    bookmark = await Bookmark.findOne(IDs);
  }

  // 3) Add user-friendly date strings
  tour.startDates.forEach((date) => {
    date.dateStr = toDateString(date.date);
  });

  // 4) Render tour details
  res.status(200).render('tourDetail', {
    title: tour.name,
    tour,
    dates: tour.startDates,
    bookmark,
  });
});

exports.getReviewForm = catchAsync(async (req, res, next) => {
  const user = req.user.id;
  const { tourId: tour, dateId: date } = req.params;
  const IDs = { user, tour, date };
  const review = (await Review.findOne(IDs)) || IDs;
  res.status(200).render('reviewForm', { title: 'Review', review });
});

exports.getLoginForm = (req, res) => {
  res.status(200).render('login', {
    title: 'Log into your account',
  });
};

exports.getSignupForm = (req, res) => {
  res.status(200).render('signup', {
    title: 'Sign up for Natours',
  });
};

exports.getAccount = (req, res) => {
  res.status(200).render('account', {
    title: 'Your account',
  });
};

// ADMINISTRATOR PAGES
// 1) TOURS
exports.manageTours = catchAsync(async (req, res, next) => {
  // Get all tours
  const tours = await Tour.find();

  // Convert a date to user-friendly string, and add it as a field
  addDateString(tours);

  res.status(200).render('manageTours', {
    title: 'Manage Tours',
    tours,
    role: 'admin',
  });
});
exports.getTourForm = catchAsync(async (req, res, next) => {
  const id = req.params.tourId;
  const tour = id ? await Tour.findById(id) : undefined;
  res.status(200).render('tourForm', {
    title: 'Create tour',
    tour,
  });
});

// 2) USERS
exports.manageUsers = catchAsync(async (req, res, next) => {
  const users = await User.find().select('+active');
  res.status(200).render('manageUsers', {
    title: 'Manage users',
    users,
  });
});
exports.getUserForm = catchAsync(async (req, res, next) => {
  const id = req.params.userId;
  const user = id ? await User.findById(id).select('+active') : undefined;
  res.status(200).render('userForm', {
    title: 'User info',
    curUser: user,
  });
});

const express = require('express');
const reviewController = require('../controllers/reviewController');
const authController = require('../controllers/authController');
const bookingController = require('../controllers/bookingController');
const factory = require('../controllers/handlerFactory');

const router = express.Router({ mergeParams: true });

router.use(authController.protect);

router
  .route('/')
  .all(factory.setTourAndUser)
  .get(reviewController.getAllReviews)
  .post(
    authController.restrictTo('user'),
    factory.setCurrentUser,
    bookingController.checkIfBooked,
    reviewController.createReview
  );

router
  .route('/:id')
  .get(reviewController.getReview)
  .all(authController.restrictTo('user', 'admin'))
  .patch(reviewController.updateReview)
  .delete(reviewController.deleteReview);

module.exports = router;

const express = require("express");
const router = express.Router();
const data = require("../../data/nj_food_pantries.json");

// GET /api/resources
router.get("/", (req, res) => {
  res.json({
    total: data.additional_resources.length,
    results: data.additional_resources,
  });
});

module.exports = router;

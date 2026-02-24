const mongoose = require("mongoose");
require("dotenv").config({ path: "e:/Fabnoor/Fabnoor-Backend/.env" });

const userSchema = new mongoose.Schema(
    {
        cartData: { type: Object, default: {} },
    },
    { minimize: false }
);
const User = mongoose.model("usertest_cart", userSchema);

async function run() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected.");

    // create dummy user
    let u = await User.create({ cartData: { "oldItem::123": { quantity: 2 } } });
    console.log("Initial:", JSON.stringify(u.cartData));

    // use $set with deeply nested path
    await User.findByIdAndUpdate(u._id, { $set: { "cartData.newItem::456": { quantity: 5 } } });

    u = await User.findById(u._id);
    console.log("After $set newItem:", JSON.stringify(u.cartData));

    await User.findByIdAndDelete(u._id);
    await mongoose.disconnect();
}
run().catch(console.error);

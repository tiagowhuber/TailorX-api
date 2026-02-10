import sequelize from '../config/database';
import User from './User';
import MeasurementType from './MeasurementType';
import UserMeasurement from './UserMeasurement';
import Design from './Design';
import DesignMeasurement from './DesignMeasurement';
import Pattern from './Pattern';
import Order from './Order';
import OrderItem from './OrderItem';
import OrderStatusHistory from './OrderStatusHistory';
import DiscountCode from './DiscountCode';
import UserHasDiscountCode from './UserHasDiscountCode';
import UserDiscountCodeRedemption from './UserDiscountCodeRedemption';
import OrderedPattern from './OrderedPattern';
import UserAddress from './UserAddress';

// Define associations
// User associations
User.hasMany(UserMeasurement, { foreignKey: 'user_id', as: 'measurements' });
User.hasMany(Pattern, { foreignKey: 'user_id', as: 'patterns' });
User.hasMany(Order, { foreignKey: 'user_id', as: 'orders' });
User.belongsToMany(DiscountCode, {
  through: UserHasDiscountCode,
  foreignKey: 'user_id',
  otherKey: 'discount_code_id',
  as: 'discountCodes',
});
User.hasMany(UserDiscountCodeRedemption, { foreignKey: 'user_id', as: 'redemptions' });

// MeasurementType associations
MeasurementType.hasMany(UserMeasurement, { foreignKey: 'measurement_type_id', as: 'userMeasurements' });
MeasurementType.hasMany(DesignMeasurement, { foreignKey: 'measurement_type_id', as: 'designMeasurements' });

// UserMeasurement associations
UserMeasurement.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
UserMeasurement.belongsTo(MeasurementType, { foreignKey: 'measurement_type_id', as: 'measurementType' });

// Design associations
Design.hasMany(DesignMeasurement, { foreignKey: 'design_id', as: 'requiredMeasurements' });
Design.hasMany(Pattern, { foreignKey: 'design_id', as: 'patterns' });

// DesignMeasurement associations
DesignMeasurement.belongsTo(Design, { foreignKey: 'design_id', as: 'design' });
DesignMeasurement.belongsTo(MeasurementType, { foreignKey: 'measurement_type_id', as: 'measurementType' });

// Pattern associations
Pattern.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
Pattern.belongsTo(Design, { foreignKey: 'design_id', as: 'design' });
Pattern.hasMany(OrderItem, { foreignKey: 'pattern_id', as: 'orderItems' });
Pattern.hasOne(OrderedPattern, { foreignKey: 'pattern_id', as: 'orderedPattern' });

// Order associations
Order.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
Order.belongsTo(DiscountCode, { foreignKey: 'discount_code_id', as: 'discountCode' });
Order.hasMany(OrderItem, { foreignKey: 'order_id', as: 'items' });
Order.hasMany(OrderStatusHistory, { foreignKey: 'order_id', as: 'statusHistory' });
Order.hasMany(OrderedPattern, { foreignKey: 'order_id', as: 'orderedPatterns' });

// DiscountCode associations
DiscountCode.belongsToMany(User, {
  through: UserHasDiscountCode,
  foreignKey: 'discount_code_id',
  otherKey: 'user_id',
  as: 'users',
});
DiscountCode.hasMany(UserDiscountCodeRedemption, {
  foreignKey: 'discount_code_id',
  as: 'redemptions',
});
DiscountCode.hasMany(Order, { foreignKey: 'discount_code_id', as: 'orders' });

// UserHasDiscountCode associations
UserHasDiscountCode.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
UserHasDiscountCode.belongsTo(DiscountCode, { foreignKey: 'discount_code_id', as: 'discountCode' });

// UserDiscountCodeRedemption associations
UserDiscountCodeRedemption.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
UserDiscountCodeRedemption.belongsTo(DiscountCode, { foreignKey: 'discount_code_id', as: 'discountCode' });
UserDiscountCodeRedemption.belongsTo(Order, { foreignKey: 'order_id', as: 'order' });

// OrderItem associations
OrderItem.belongsTo(Order, { foreignKey: 'order_id', as: 'order' });
OrderItem.belongsTo(Pattern, { foreignKey: 'pattern_id', as: 'pattern' });

// OrderStatusHistory associations
OrderStatusHistory.belongsTo(Order, { foreignKey: 'order_id', as: 'order' });

// UserAddress associations
UserAddress.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// OrderedPattern associations
OrderedPattern.belongsTo(Order, { foreignKey: 'order_id', as: 'order' });
OrderedPattern.belongsTo(Pattern, { foreignKey: 'pattern_id', as: 'pattern' });

// Export models and sequelize instance
export {
  sequelize,
  User,
  MeasurementType,
  UserMeasurement,
  Design,
  DesignMeasurement,
  Pattern,
  Order,
  OrderItem,
  OrderStatusHistory,
  DiscountCode,
  UserHasDiscountCode,
  UserDiscountCodeRedemption,
  OrderedPattern,
  UserAddress,
};

export default {
  sequelize,
  User,
  MeasurementType,
  UserMeasurement,
  Design,
  DesignMeasurement,
  Pattern,
  Order,
  OrderItem,
  OrderStatusHistory,
  DiscountCode,
  UserHasDiscountCode,
  UserDiscountCodeRedemption,
  OrderedPattern,
  UserAddress,
};
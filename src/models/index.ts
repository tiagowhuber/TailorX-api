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

// Define associations
// User associations
User.hasMany(UserMeasurement, { foreignKey: 'user_id', as: 'measurements' });
User.hasMany(Pattern, { foreignKey: 'user_id', as: 'patterns' });
User.hasMany(Order, { foreignKey: 'user_id', as: 'orders' });

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

// Order associations
Order.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
Order.hasMany(OrderItem, { foreignKey: 'order_id', as: 'items' });
Order.hasMany(OrderStatusHistory, { foreignKey: 'order_id', as: 'statusHistory' });

// OrderItem associations
OrderItem.belongsTo(Order, { foreignKey: 'order_id', as: 'order' });
OrderItem.belongsTo(Pattern, { foreignKey: 'pattern_id', as: 'pattern' });

// OrderStatusHistory associations
OrderStatusHistory.belongsTo(Order, { foreignKey: 'order_id', as: 'order' });

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
};
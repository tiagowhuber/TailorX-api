import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface OrderItemAttributes {
  id: number;
  order_id: number;
  pattern_id: number;
  quantity?: number;
  price: number;
  created_at?: Date;
}

interface OrderItemCreationAttributes extends Optional<OrderItemAttributes, 'id' | 'created_at'> {}

class OrderItem extends Model<OrderItemAttributes, OrderItemCreationAttributes> implements OrderItemAttributes {
  public id!: number;
  public order_id!: number;
  public pattern_id!: number;
  public quantity?: number;
  public price!: number;
  public created_at?: Date;
}

OrderItem.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    order_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'orders',
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
    pattern_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'patterns',
        key: 'id',
      },
      onDelete: 'RESTRICT',
    },
    quantity: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'order_items',
    timestamps: false,
    indexes: [
      {
        fields: ['order_id'],
      },
      {
        fields: ['pattern_id'],
      },
    ],
  }
);

export default OrderItem;
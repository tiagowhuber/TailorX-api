import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface OrderAttributes {
  id: number;
  user_id: number;
  order_number: string;
  status?: string;
  total_amount: number;
  discount_code_id?: number | null;
  discount_amount?: number;
  final_amount?: number;
  shipping_address?: string; // serialized JSON or text
  billing_address?: string; // serialized JSON or text
  created_at?: Date;
  updated_at?: Date;
}

interface OrderCreationAttributes extends Optional<OrderAttributes, 'id' | 'created_at' | 'updated_at'> {}

class Order extends Model<OrderAttributes, OrderCreationAttributes> implements OrderAttributes {
  public id!: number;
  public user_id!: number;
  public order_number!: string;
  public status?: string;
  public total_amount!: number;
  public discount_code_id?: number | null;
  public discount_amount?: number;
  public final_amount?: number;
  public shipping_address?: string;
  public billing_address?: string;
  public created_at?: Date;
  public updated_at?: Date;
}

Order.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
    order_number: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },
    status: {
      type: DataTypes.STRING(50),
      defaultValue: 'pending',
    },
    total_amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    discount_code_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    discount_amount: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0,
    },
    final_amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    billing_address: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'orders',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        fields: ['user_id'],
      },
      {
        fields: ['status'],
      },
      {
        fields: ['order_number'],
      },
    ],
  }
);

export default Order;
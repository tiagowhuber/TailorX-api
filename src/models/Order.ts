import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface OrderAttributes {
  id: number;
  user_id: number;
  order_number: string;
  status?: string;
  total_amount: number;
  shipping_address?: string;
  billing_address?: string;
  payment_status?: string;
  payment_method?: string;
  payment_token?: string;
  payment_url?: string;
  transaction_id?: string;
  session_id?: string;
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
  public shipping_address?: string;
  public billing_address?: string;
  public payment_status?: string;
  public payment_method?: string;
  public payment_token?: string;
  public payment_url?: string;
  public transaction_id?: string;
  public session_id?: string;
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
    shipping_address: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    billing_address: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    payment_status: {
      type: DataTypes.STRING(50),
      defaultValue: 'pending',
    },
    payment_method: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    payment_token: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    payment_url: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    transaction_id: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    session_id: {
      type: DataTypes.STRING(255),
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
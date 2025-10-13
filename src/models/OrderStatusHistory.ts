import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface OrderStatusHistoryAttributes {
  id: number;
  order_id: number;
  status: string;
  notes?: string;
  created_at?: Date;
}

interface OrderStatusHistoryCreationAttributes extends Optional<OrderStatusHistoryAttributes, 'id' | 'created_at'> {}

class OrderStatusHistory extends Model<OrderStatusHistoryAttributes, OrderStatusHistoryCreationAttributes> implements OrderStatusHistoryAttributes {
  public id!: number;
  public order_id!: number;
  public status!: string;
  public notes?: string;
  public created_at?: Date;
}

OrderStatusHistory.init(
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
    status: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'order_status_history',
    timestamps: false,
    indexes: [
      {
        fields: ['order_id'],
      },
    ],
  }
);

export default OrderStatusHistory;
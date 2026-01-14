import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface OrderedPatternAttributes {
  id: number;
  order_id: number;
  pattern_id: number; // Reference to the user's original pattern
  svg_normal?: string;
  svg_mirrored?: string;
  created_at?: Date;
  updated_at?: Date;
}

interface OrderedPatternCreationAttributes extends Optional<OrderedPatternAttributes, 'id' | 'created_at' | 'updated_at'> {}

class OrderedPattern extends Model<OrderedPatternAttributes, OrderedPatternCreationAttributes> implements OrderedPatternAttributes {
  public id!: number;
  public order_id!: number;
  public pattern_id!: number;
  public svg_normal?: string;
  public svg_mirrored?: string;
  public created_at?: Date;
  public updated_at?: Date;
}

OrderedPattern.init(
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
      onDelete: 'CASCADE',
    },
    svg_normal: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    svg_mirrored: {
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
    tableName: 'ordered_patterns',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
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

export default OrderedPattern;

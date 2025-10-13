import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface UserMeasurementAttributes {
  id: number;
  user_id: number;
  measurement_type_id: number;
  value: number;
  created_at?: Date;
  updated_at?: Date;
}

interface UserMeasurementCreationAttributes extends Optional<UserMeasurementAttributes, 'id' | 'created_at' | 'updated_at'> {}

class UserMeasurement extends Model<UserMeasurementAttributes, UserMeasurementCreationAttributes> implements UserMeasurementAttributes {
  public id!: number;
  public user_id!: number;
  public measurement_type_id!: number;
  public value!: number;
  public created_at?: Date;
  public updated_at?: Date;
}

UserMeasurement.init(
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
    measurement_type_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'measurement_types',
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
    value: {
      type: DataTypes.DECIMAL(6, 2),
      allowNull: false,
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
    tableName: 'user_measurements',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        fields: ['user_id'],
      },
      {
        unique: true,
        fields: ['user_id', 'measurement_type_id'],
      },
    ],
  }
);

export default UserMeasurement;
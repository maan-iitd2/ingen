import React from 'react';
import './DataPreview.css';

export default function DataPreview() {
  return (
    <div className="data-preview-container">
      <table className="preview-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Email</th>
            <th>Status</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>1</td>
            <td>John Doe</td>
            <td>john@example.com</td>
            <td><span className="badge badge-success">Active</span></td>
            <td>$120.00</td>
          </tr>
          <tr>
            <td>2</td>
            <td>Jane Smith</td>
            <td>jane@example.com</td>
            <td><span className="badge badge-success">Active</span></td>
            <td>$350.50</td>
          </tr>
          <tr>
            <td>3</td>
            <td>Bob Johnson</td>
            <td>bob@example.com</td>
            <td><span className="badge badge-danger">Inactive</span></td>
            <td>$0.00</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
